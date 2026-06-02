import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember, requireAccessTier } from '@/lib/dal'
import { getVapidPublicKey, sendPushToMember } from '@/lib/push'
import { absoluteUrl, resolveMemberEmail, sendEmail } from '@/lib/email/send'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe'
import { assignmentEmail, mentionEmail } from '@/lib/email/templates'
import { parseExternalRef } from '@/lib/externalRef'
import { scrapeDocTitle } from '@/lib/scrapeDocTitle'
import { countMissingFields, isHandoffComplete, HANDOFF_FIELDS } from '@/lib/handoff'
import type { Database, Json } from '@/supabase/types'

type TaskStatus = Database['public']['Enums']['task_status']
type TaskPriority = Database['public']['Enums']['task_priority']
type RelationKind = Database['public']['Enums']['relation_kind']

// ─── Result shape preserved from the Prisma era ──────────────────────────
export type StatusChangeResult =
  | { ok: true }
  | {
      ok: false
      reason: 'handoff-incomplete' | 'generic'
      message: string
      missingCount?: number
      taskUrl?: string
    }

export type RenameProjectState =
  | { error: string; fieldErrors?: Record<string, string[]> }
  | undefined

// ─── Snake -> camel helpers for returned rows ─────────────────────────────
// The shell (DashboardShell) consumes mutation returns with camelCase
// field names, so we transform before returning. These helpers cover only
// the rows shipped back to clients - internal queries can keep snake_case.

type TaskRow = Database['public']['Tables']['tasks']['Row']
type TaskExternalRefRow = Database['public']['Tables']['task_external_refs']['Row']
type ProjectExternalRefRow = Database['public']['Tables']['project_external_refs']['Row']

function toCamelTask(t: TaskRow) {
  return {
    id: t.id,
    companyId: t.company_id,
    projectId: t.project_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    ref: t.ref,
    seqNumber: t.seq_number,
    sortOrder: t.sort_order,
    assigneeId: t.assignee_id,
    leadId: t.lead_id,
    dueDate: t.due_date,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  }
}

function toCamelTaskRef(r: TaskExternalRefRow) {
  return {
    id: r.id,
    taskId: r.task_id,
    kind: r.kind,
    url: r.url,
    label: r.label,
    createdAt: r.created_at
  }
}

function toCamelProjectRef(r: ProjectExternalRefRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    kind: r.kind,
    url: r.url,
    label: r.label,
    createdAt: r.created_at
  }
}

// ─── Activity log helper ─────────────────────────────────────────────────
async function logActivity(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from('activity_logs').insert({
    company_id: companyId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ? (metadata as Json) : null
  })
}

// Centralized task-edit gate. 'planner' fields (priority/assignee/lead/
// due_date/relations) can only be touched by admins or leads. 'owner'
// fields (status/comments/links/handoff) can be touched by an admin/lead
// OR by the task's own assignee. Returns the member on success, or an
// error string the caller can pass straight back to the client - the
// optimistic UI in DashboardShell rolls back on { error }.
async function ensureTaskAccess(
  taskId: string,
  kind: 'planner' | 'owner' | 'commenter'
): Promise<
  | { member: Awaited<ReturnType<typeof getCurrentTeamMember>> & object }
  | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const isPlanner =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  if (kind === 'planner') {
    if (!isPlanner) {
      return { error: 'Only leads or admins can change this.' }
    }
    return { member }
  }
  if (isPlanner) return { member }
  const supabase = createAdminClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id')
    .eq('id', taskId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!task) return { error: 'Task not found.' }
  if (task.assignee_id === member.id) return { member }
  // Watchers (Slice B) are allowed to comment but NOT to invoke owner-level
  // edits (title / description / status / assignee / etc.). Only widen the
  // gate for the 'commenter' kind.
  if (kind === 'commenter') {
    const { data: watcher } = await supabase
      .from('task_watchers')
      .select('member_id')
      .eq('task_id', taskId)
      .eq('member_id', member.id)
      .maybeSingle()
    if (watcher) return { member }
  }
  return { error: 'You can only edit tasks assigned to you.' }
}

// ─── Bulk-add validation (decision 0025) ──────────────────────────────────
const TaskStatusEnum = z.enum([
  'backlog', 'unscoped', 'todo', 'in_progress', 'in_review', 'done', 'canceled', 'duplicate'
])
const TaskPriorityEnum = z.enum(['urgent', 'high', 'medium', 'low', 'none'])
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const RelationKindEnum = z.enum(['blocked_by', 'blocks', 'parent', 'sub_issue', 'triage'])

const BulkDraftSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(500),
  description: z.string().nullish(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  assigneeId: z.string().uuid().nullish(),
  dueDate: IsoDate.nullish(),
  labelIds: z.array(z.string().uuid()).optional(),
  newLabelNames: z.array(z.string().trim().min(1).max(64)).optional(),
  relations: z.array(z.object({ kind: RelationKindEnum, ref: z.string().trim().min(1) })).optional()
})

const CreateBulkInputSchema = z.object({
  projectId: z.string().uuid('projectId must be a valid UUID'),
  drafts: z.array(BulkDraftSchema).min(1, 'at least one task is required').max(50, 'too many tasks in one batch')
})

// ─── Task mutations ───────────────────────────────────────────────────────

export async function createDashboardTask(data: {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  projectId: string
  assigneeId?: string | null
  leadId?: string | null
  dueDate?: string | null
  labelIds?: string[]
  relations?: { kind: RelationKind; ref: string }[]
}) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  // Sequential ref per project. Uses seq_number max+1.
  const { data: lastTask } = await supabase
    .from('tasks')
    .select('seq_number')
    .eq('project_id', data.projectId)
    .order('seq_number', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  const nextSeq = (lastTask?.seq_number ?? 0) + 1

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', data.projectId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!project) return { error: 'Project not found.' }

  // Same lead-tier constraint as updateDashboardTaskLead. Run before the
  // INSERT so we never persist a member as the "ask for help" target.
  if (data.leadId) {
    const { data: candidate } = await supabase
      .from('team_members')
      .select('access_tier')
      .eq('id', data.leadId)
      .eq('company_id', member.companyId)
      .maybeSingle()
    if (!candidate) return { error: 'Lead not found.' }
    if (candidate.access_tier === 'member') {
      return { error: 'Lead must be an admin or a lead.' }
    }
  }

  const prefix = project.name.split(/\s+/)[0].toUpperCase().slice(0, 4)
  const ref = `${prefix}-${nextSeq}`

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      company_id: member.companyId,
      project_id: data.projectId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'backlog',
      priority: data.priority ?? 'none',
      ref,
      seq_number: nextSeq,
      assignee_id: data.assigneeId ?? null,
      lead_id: data.leadId ?? null,
      due_date: data.dueDate ?? null,
      created_by: member.id
    })
    .select('*')
    .single()
  if (taskErr || !task) return { error: taskErr?.message ?? 'Create failed.' }

  if (data.labelIds?.length) {
    await supabase.from('task_labels').insert(
      data.labelIds.map((labelId) => ({ task_id: task.id, label_id: labelId }))
    )
  }

  if (data.relations && data.relations.length > 0) {
    const refs = [...new Set(data.relations.map((r) => r.ref))]
    const { data: targets } = await supabase
      .from('tasks')
      .select('id, ref')
      .eq('company_id', member.companyId)
      .in('ref', refs)
    const idByRef = new Map((targets ?? []).map((t) => [t.ref ?? '', t.id]))
    const rows = data.relations
      .map((r) => {
        const target = idByRef.get(r.ref)
        if (!target || target === task.id) return null
        return {
          company_id: member.companyId,
          task_id: task.id,
          depends_on_task_id: target,
          kind: r.kind
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
    if (rows.length > 0) {
      await supabase.from('task_dependencies').insert(rows)
    }
  }

  await logActivity(supabase, member.companyId, member.id, 'task.created', 'task', task.id)
  revalidatePath('/dashboard')
  return { task: toCamelTask(task) }
}

const AddDepInput = z.object({
  taskId: z.string().uuid(),
  dependsOnRef: z.string().trim().min(1).max(64),
  kind: z.enum(['blocked_by', 'blocks', 'parent', 'sub_issue', 'triage'])
})

export async function addTaskDependency(
  input: z.input<typeof AddDepInput>
): Promise<
  | { error: string }
  | { ok: true; dep: { id: string; kind: RelationKind; dependsOnRef: string } }
> {
  const parsed = AddDepInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const [sourceRes, targetRes] = await Promise.all([
    supabase
      .from('tasks').select('id')
      .eq('id', parsed.data.taskId).eq('company_id', member.companyId).maybeSingle(),
    supabase
      .from('tasks').select('id, ref')
      .eq('ref', parsed.data.dependsOnRef).eq('company_id', member.companyId).maybeSingle()
  ])
  const source = sourceRes.data
  const target = targetRes.data
  if (!source) return { error: 'Task not found.' }
  if (!target) return { error: `No task with ref ${parsed.data.dependsOnRef}.` }
  if (target.id === source.id) return { error: "Can't relate a task to itself." }

  const { data: dep, error } = await supabase
    .from('task_dependencies')
    .upsert({
      company_id: member.companyId,
      task_id: source.id,
      depends_on_task_id: target.id,
      kind: parsed.data.kind
    }, { onConflict: 'task_id,depends_on_task_id' })
    .select('id, kind')
    .single()
  if (error || !dep) return { error: error?.message ?? 'Could not create relation.' }

  revalidatePath('/dashboard')
  return {
    ok: true,
    dep: {
      id: dep.id,
      kind: dep.kind,
      dependsOnRef: target.ref ?? parsed.data.dependsOnRef
    }
  }
}

const RemoveDepInput = z.object({
  taskId: z.string().uuid(),
  dependsOnRef: z.string().trim().min(1).max(64),
  kind: z.enum(['blocked_by', 'blocks', 'parent', 'sub_issue', 'triage'])
})

export async function removeTaskDependency(input: z.input<typeof RemoveDepInput>) {
  const parsed = RemoveDepInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: target } = await supabase
    .from('tasks').select('id')
    .eq('ref', parsed.data.dependsOnRef).eq('company_id', member.companyId).maybeSingle()
  if (!target) return { error: 'Ref not found.' }

  await supabase
    .from('task_dependencies').delete()
    .eq('company_id', member.companyId)
    .eq('task_id', parsed.data.taskId)
    .eq('depends_on_task_id', target.id)
    .eq('kind', parsed.data.kind)

  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function createBulkDashboardTasks(
  projectId: string,
  drafts: z.input<typeof BulkDraftSchema>[]
) {
  const validated = CreateBulkInputSchema.safeParse({ projectId, drafts })
  if (!validated.success) {
    const first = validated.error.issues[0]
    const path = first.path
      .map((seg) => (typeof seg === 'number' ? `[${seg}]` : `.${String(seg)}`))
      .join('').replace(/^\./, '')
    return { error: path ? `${path}: ${first.message}` : first.message }
  }
  const { drafts: validDrafts } = validated.data
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: project } = await supabase
    .from('projects').select('name')
    .eq('id', projectId).eq('company_id', member.companyId).maybeSingle()
  if (!project) return { error: 'Project not found.' }

  const prefix = project.name.split(/\s+/)[0].toUpperCase().slice(0, 4)
  const { data: lastTask } = await supabase
    .from('tasks').select('seq_number')
    .eq('project_id', projectId)
    .order('seq_number', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle()
  let nextSeq = (lastTask?.seq_number ?? 0) + 1

  // Collect distinct new label names across drafts, preserve first-seen casing.
  const newLabelDisplayByLower = new Map<string, string>()
  for (const d of validDrafts) {
    for (const raw of d.newLabelNames ?? []) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (!newLabelDisplayByLower.has(key)) newLabelDisplayByLower.set(key, trimmed)
    }
  }

  // Resolve / create labels first.
  const newLabelIdByLower = new Map<string, string>()
  for (const [key, display] of newLabelDisplayByLower) {
    const { data: existing } = await supabase
      .from('labels').select('id')
      .eq('company_id', member.companyId).ilike('name', display).maybeSingle()
    if (existing) {
      newLabelIdByLower.set(key, existing.id)
    } else {
      const { data: fresh } = await supabase
        .from('labels')
        .insert({ company_id: member.companyId, name: display })
        .select('id').single()
      if (fresh) newLabelIdByLower.set(key, fresh.id)
    }
  }

  // Create tasks sequentially so ref numbers stay strict.
  const out: { id: string; ref: string }[] = []
  const pendingDeps: { sourceId: string; ref: string; kind: RelationKind }[] = []

  for (const d of validDrafts) {
    const seq = nextSeq++
    const ref = `${prefix}-${seq}`
    const labelIds = new Set<string>(d.labelIds ?? [])
    for (const raw of d.newLabelNames ?? []) {
      const id = newLabelIdByLower.get(raw.trim().toLowerCase())
      if (id) labelIds.add(id)
    }
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        company_id: member.companyId,
        project_id: projectId,
        title: d.title,
        description: d.description ?? null,
        status: d.status ?? 'backlog',
        priority: d.priority ?? 'none',
        ref,
        seq_number: seq,
        assignee_id: d.assigneeId ?? null,
        due_date: d.dueDate ?? null,
        created_by: member.id
      })
      .select('id, ref').single()
    if (!task) continue
    if (labelIds.size > 0) {
      await supabase.from('task_labels').insert(
        [...labelIds].map((labelId) => ({ task_id: task.id, label_id: labelId }))
      )
    }
    await logActivity(supabase, member.companyId, member.id, 'task.created', 'task', task.id)
    out.push({ id: task.id, ref: task.ref ?? ref })
    for (const rel of d.relations ?? []) {
      pendingDeps.push({ sourceId: task.id, ref: rel.ref, kind: rel.kind })
    }
  }

  if (pendingDeps.length > 0) {
    const refs = [...new Set(pendingDeps.map((p) => p.ref))]
    const { data: targets } = await supabase
      .from('tasks').select('id, ref')
      .eq('company_id', member.companyId).in('ref', refs)
    const idByRef = new Map((targets ?? []).map((t) => [t.ref ?? '', t.id]))
    const depRows = pendingDeps
      .map((p) => {
        const targetId = idByRef.get(p.ref)
        if (!targetId || targetId === p.sourceId) return null
        return {
          company_id: member.companyId,
          task_id: p.sourceId,
          depends_on_task_id: targetId,
          kind: p.kind
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
    if (depRows.length > 0) {
      await supabase.from('task_dependencies').upsert(depRows, {
        onConflict: 'task_id,depends_on_task_id', ignoreDuplicates: true
      })
    }
  }

  revalidatePath('/dashboard')
  return { tasks: out, createdLabels: [...newLabelDisplayByLower.values()] }
}

export async function updateDashboardTaskStatus(
  taskId: string, status: TaskStatus
): Promise<StatusChangeResult> {
  const gate = await ensureTaskAccess(taskId, 'owner')
  if ('error' in gate) {
    return { ok: false, reason: 'generic', message: gate.error }
  }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, project_id, status, handoffs!handoff_task_id_fkey(what_it_is, current_status, done_so_far, still_left, file_links, gotchas, who_to_ask)')
    .eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!task) return { ok: false, reason: 'generic', message: 'Task not found.' }

  // handoffs is fetched as an array (1:1 by uniq constraint but the type comes back as array)
  const handoffRow = (Array.isArray(task.handoffs) ? task.handoffs[0] : task.handoffs) ?? null
  const handoff = handoffRow ? {
    whatItIs: handoffRow.what_it_is,
    currentStatus: handoffRow.current_status,
    doneSoFar: handoffRow.done_so_far,
    stillLeft: handoffRow.still_left,
    fileLinks: handoffRow.file_links,
    gotchas: handoffRow.gotchas,
    whoToAsk: handoffRow.who_to_ask
  } : null

  // Sending to review: handoff must be complete. The work is being
  // packaged for the next person, so the seven prompts have to be
  // answered before review can start.
  if (status === 'in_review' && task.status !== 'in_review') {
    if (!isHandoffComplete(handoff)) {
      const missing = countMissingFields(handoff)
      return {
        ok: false,
        reason: 'handoff-incomplete',
        message: handoff
          ? `Fill ${missing} more handoff field${missing === 1 ? '' : 's'} before sending to review.`
          : 'Start a handoff and fill all 7 fields before sending to review.',
        missingCount: missing,
        taskUrl: `/projects/${task.project_id}/tasks/${task.id}`
      }
    }
  }

  // Marking Done is the approval step. Only admins + leads can flip it.
  if (status === 'done' && task.status !== 'done') {
    if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
      return {
        ok: false,
        reason: 'generic',
        message: 'Only admins and leads can mark a task as Done.'
      }
    }
  }

  const prevStatus = task.status
  await supabase.from('tasks').update({ status }).eq('id', task.id)

  if (prevStatus !== status) {
    await logActivity(supabase, member.companyId, member.id, 'task.status_changed', 'task', task.id, {
      from: prevStatus, to: status
    })
  }
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${task.project_id}`)
  return { ok: true }
}

export async function updateDashboardTaskPriority(taskId: string, priority: TaskPriority) {
  const gate = await ensureTaskAccess(taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: prev } = await supabase
    .from('tasks').select('priority').eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!prev) return { error: 'Task not found.' }

  await supabase.from('tasks').update({ priority }).eq('id', taskId)
  if (prev.priority !== priority) {
    await logActivity(supabase, member.companyId, member.id, 'task.priority_changed', 'task', taskId, {
      from: prev.priority, to: priority
    })
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskAssignee(taskId: string, assigneeId: string | null) {
  const gate = await ensureTaskAccess(taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: prev } = await supabase
    .from('tasks')
    .select('assignee_id, assignee:team_members!task_assignee_id_fkey(full_name)')
    .eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!prev) return { error: 'Task not found.' }

  await supabase.from('tasks').update({ assignee_id: assigneeId }).eq('id', taskId)

  if (prev.assignee_id !== assigneeId) {
    let toName: string | null = null
    if (assigneeId) {
      const { data: nameRow } = await supabase
        .from('team_members').select('full_name').eq('id', assigneeId).maybeSingle()
      toName = nameRow?.full_name ?? null
    }
    const prevAssignee = prev.assignee as { full_name: string } | null
    await logActivity(supabase, member.companyId, member.id, 'task.assignee_changed', 'task', taskId, {
      from: prev.assignee_id,
      fromName: prevAssignee?.full_name ?? null,
      to: assigneeId,
      toName
    })
    // Ping the new assignee (never yourself) via web-push + email.
    if (assigneeId && assigneeId !== member.id) {
      const { data: t } = await supabase
        .from('tasks').select('ref, title').eq('id', taskId).maybeSingle()
      if (t?.ref) {
        await sendPushToMember(assigneeId, {
          title: `Assigned to you: ${t.ref}`,
          body: t.title ?? '',
          url: `/share/${t.ref}`,
          tag: `task:${t.ref}`
        }).catch(() => undefined)

        const [{ data: recipient }, { data: pref }] = await Promise.all([
          supabase
            .from('team_members')
            .select('full_name, contact_email, email')
            .eq('id', assigneeId)
            .maybeSingle(),
          supabase
            .from('notification_email_prefs')
            .select('assigned')
            .eq('member_id', assigneeId)
            .maybeSingle()
        ])
        const allowed = pref?.assigned !== false
        const to =
          recipient &&
          ((recipient.contact_email && recipient.contact_email.trim()) ||
            recipient.email)
        if (allowed && recipient && to) {
          const unsubscribeUrl = await buildUnsubscribeUrl(assigneeId)
          const { subject, html, text } = assignmentEmail({
            recipientName: recipient.full_name,
            assignerName: member.fullName,
            taskRef: t.ref,
            taskTitle: t.title ?? '',
            taskUrl: absoluteUrl(`/share/${t.ref}`),
            unsubscribeUrl
          })
          await sendEmail({
            to,
            subject,
            html,
            text,
            unsubscribeUrl,
            tag: 'assignment'
          }).catch(() => undefined)
        }
      }
    }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskLead(taskId: string, leadId: string | null) {
  const gate = await ensureTaskAccess(taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  // Leads can only be admins or leads. Members shouldn't be set as the
  // "ask for help" person for someone equal or senior; UI pickers already
  // filter this, defend at the action boundary too.
  if (leadId) {
    const { data: candidate } = await supabase
      .from('team_members')
      .select('access_tier')
      .eq('id', leadId)
      .eq('company_id', member.companyId)
      .maybeSingle()
    if (!candidate) return { error: 'Lead not found.' }
    if (candidate.access_tier === 'member') {
      return { error: 'Lead must be an admin or a lead.' }
    }
  }

  const { data: prev } = await supabase
    .from('tasks')
    .select('lead_id, lead:team_members!task_lead_id_fkey(full_name)')
    .eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!prev) return { error: 'Task not found.' }

  await supabase.from('tasks').update({ lead_id: leadId }).eq('id', taskId)

  if (prev.lead_id !== leadId) {
    let toName: string | null = null
    if (leadId) {
      const { data: nameRow } = await supabase
        .from('team_members').select('full_name').eq('id', leadId).maybeSingle()
      toName = nameRow?.full_name ?? null
    }
    const prevLead = prev.lead as { full_name: string } | null
    await logActivity(supabase, member.companyId, member.id, 'task.lead_changed', 'task', taskId, {
      from: prev.lead_id,
      fromName: prevLead?.full_name ?? null,
      to: leadId,
      toName
    })
    // Ping the new lead (never yourself).
    if (leadId && leadId !== member.id) {
      const { data: t } = await supabase
        .from('tasks').select('ref, title').eq('id', taskId).maybeSingle()
      if (t?.ref) {
        await sendPushToMember(leadId, {
          title: `You're now lead on ${t.ref}`,
          body: t.title ?? '',
          url: `/share/${t.ref}`,
          tag: `task:${t.ref}`
        }).catch(() => undefined)
      }
    }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Update a task's due_date and auto-tag the change direction. If the task
// previously had a due date and the new one is different, we add a label:
//   - 'postponed' when the new date is later than the previous one
//   - 'early'     when the new date is earlier
// The two are mutually exclusive: adding one removes the other, so the
// tag always reflects the MOST RECENT change. No tag added when going
// from null -> date (there's nothing to compare against) or when the
// date doesn't actually change.
// Title + description live together because edits typically come from the
// task detail's body and the activity log only needs one entry per save.
const UpdateTaskDetailsInput = z
  .object({
    taskId: z.string().uuid(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(5000).nullable().optional()
  })
  .refine(
    (v) => v.title !== undefined || v.description !== undefined,
    { message: 'Nothing to update.' }
  )

export async function updateDashboardTaskDetails(
  input: z.input<typeof UpdateTaskDetailsInput>
) {
  const parsed = UpdateTaskDetailsInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: prev } = await supabase
    .from('tasks')
    .select('title, description')
    .eq('id', parsed.data.taskId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!prev) return { error: 'Task not found.' }

  const patch: Database['public']['Tables']['tasks']['Update'] = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description
  }
  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', parsed.data.taskId)
  if (error) return { error: error.message }

  if (parsed.data.title !== undefined && parsed.data.title !== prev.title) {
    await logActivity(
      supabase,
      member.companyId,
      member.id,
      'task.title_changed',
      'task',
      parsed.data.taskId,
      { from: prev.title, to: parsed.data.title }
    )
  }
  if (
    parsed.data.description !== undefined &&
    parsed.data.description !== prev.description
  ) {
    await logActivity(
      supabase,
      member.companyId,
      member.id,
      'task.description_changed',
      'task',
      parsed.data.taskId
    )
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskDueDate(
  taskId: string,
  dueDate: string | null
) {
  const gate = await ensureTaskAccess(taskId, 'planner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: prev } = await supabase
    .from('tasks')
    .select('due_date')
    .eq('id', taskId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!prev) return { error: 'Task not found.' }

  await supabase
    .from('tasks')
    .update({ due_date: dueDate })
    .eq('id', taskId)

  const prevDate = prev.due_date
  if (prevDate && dueDate && prevDate !== dueDate) {
    const direction: 'postponed' | 'early' =
      dueDate > prevDate ? 'postponed' : 'early'
    const opposite: 'postponed' | 'early' =
      direction === 'postponed' ? 'early' : 'postponed'

    // Resolve (or create) both labels so we can swap them atomically.
    const { data: existing } = await supabase
      .from('labels')
      .select('id, name')
      .eq('company_id', member.companyId)
      .in('name', ['postponed', 'early'])
    const idByName = new Map<string, string>(
      (existing ?? []).map((l) => [l.name, l.id])
    )
    const ensure = async (name: 'postponed' | 'early') => {
      const found = idByName.get(name)
      if (found) return found
      const { data: created } = await supabase
        .from('labels')
        .insert({ company_id: member.companyId, name })
        .select('id')
        .single()
      if (created) idByName.set(name, created.id)
      return created?.id
    }
    const addId = await ensure(direction)
    const removeId = idByName.get(opposite)

    if (addId) {
      await supabase.from('task_labels').upsert(
        { task_id: taskId, label_id: addId },
        { onConflict: 'task_id,label_id', ignoreDuplicates: true }
      )
    }
    if (removeId) {
      await supabase
        .from('task_labels')
        .delete()
        .eq('task_id', taskId)
        .eq('label_id', removeId)
    }
  }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.due_changed',
    'task',
    taskId,
    { from: prevDate, to: dueDate }
  )
  revalidatePath('/dashboard')
  return { ok: true }
}

const SORT_STEP = 1024

export async function moveDashboardTask(
  taskId: string, toStatus: TaskStatus, toIndex: number
): Promise<StatusChangeResult> {
  const member = await getCurrentTeamMember()
  if (!member) return { ok: false, reason: 'generic', message: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, project_id, status, handoffs!handoff_task_id_fkey(what_it_is, current_status, done_so_far, still_left, file_links, gotchas, who_to_ask)')
    .eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!task) return { ok: false, reason: 'generic', message: 'Task not found.' }

  const handoffRow = (Array.isArray(task.handoffs) ? task.handoffs[0] : task.handoffs) ?? null
  const handoff = handoffRow ? {
    whatItIs: handoffRow.what_it_is,
    currentStatus: handoffRow.current_status,
    doneSoFar: handoffRow.done_so_far,
    stillLeft: handoffRow.still_left,
    fileLinks: handoffRow.file_links,
    gotchas: handoffRow.gotchas,
    whoToAsk: handoffRow.who_to_ask
  } : null

  // Drag-to-review: handoff gate. Same as the click path.
  if (toStatus === 'in_review' && task.status !== 'in_review') {
    if (!isHandoffComplete(handoff)) {
      const missing = countMissingFields(handoff)
      return {
        ok: false,
        reason: 'handoff-incomplete',
        message: handoff
          ? `Fill ${missing} more handoff field${missing === 1 ? '' : 's'} before sending to review.`
          : 'Start a handoff and fill all 7 fields before sending to review.',
        missingCount: missing,
        taskUrl: `/projects/${task.project_id}/tasks/${task.id}`
      }
    }
  }
  // Drag-to-done: admin / lead approval only.
  if (toStatus === 'done' && task.status !== 'done') {
    if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
      return {
        ok: false,
        reason: 'generic',
        message: 'Only admins and leads can mark a task as Done.'
      }
    }
  }

  const { data: columnTasks } = await supabase
    .from('tasks').select('id')
    .eq('company_id', member.companyId).eq('status', toStatus).neq('id', task.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const clampedIndex = Math.max(0, Math.min(toIndex, (columnTasks ?? []).length))
  const newOrder = [
    ...(columnTasks ?? []).slice(0, clampedIndex).map((t) => t.id),
    task.id,
    ...(columnTasks ?? []).slice(clampedIndex).map((t) => t.id)
  ]

  // Status flip first (the moved row only), then renumber the destination
  // column. No transaction available; on partial failure the next move
  // (or a router.refresh) restores consistent ordering.
  await supabase.from('tasks').update({ status: toStatus }).eq('id', task.id)
  for (let i = 0; i < newOrder.length; i++) {
    await supabase.from('tasks').update({ sort_order: i * SORT_STEP }).eq('id', newOrder[i])
  }

  if (toStatus !== task.status) {
    await logActivity(supabase, member.companyId, member.id, 'task.status_changed', 'task', task.id, {
      from: task.status, to: toStatus
    })
  }
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${task.project_id}`)
  return { ok: true }
}

export async function deleteDashboardTask(taskId: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
    return { error: 'Only admins and leads can delete tasks.' }
  }
  const supabase = createAdminClient()

  await supabase.from('tasks').delete().eq('id', taskId).eq('company_id', member.companyId)
  await logActivity(supabase, member.companyId, member.id, 'task.deleted', 'task', taskId)
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function duplicateDashboardTask(taskId: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: src } = await supabase
    .from('tasks').select('*').eq('id', taskId).eq('company_id', member.companyId).maybeSingle()
  if (!src) return { error: 'Task not found.' }

  const [{ data: srcLabels }, { data: srcChecklist }, { data: lastTask }, { data: project }] = await Promise.all([
    supabase.from('task_labels').select('label_id').eq('task_id', src.id),
    supabase.from('task_checklist_items').select('text, sort_order').eq('task_id', src.id),
    supabase.from('tasks').select('seq_number').eq('project_id', src.project_id)
      .order('seq_number', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from('projects').select('name').eq('id', src.project_id).maybeSingle()
  ])
  const nextSeq = (lastTask?.seq_number ?? 0) + 1
  const prefix = (project?.name ?? 'TASK').split(/\s+/)[0].toUpperCase().slice(0, 4)
  const ref = `${prefix}-${nextSeq}`

  const { data: clone, error } = await supabase
    .from('tasks')
    .insert({
      company_id: member.companyId,
      project_id: src.project_id,
      title: `${src.title} (copy)`,
      status: src.status,
      sort_order: src.sort_order != null ? src.sort_order + 1 : null,
      priority: src.priority,
      ref,
      seq_number: nextSeq,
      assignee_id: src.assignee_id,
      due_date: src.due_date,
      created_by: member.id
    })
    .select('*').single()
  if (error || !clone) return { error: error?.message ?? 'Duplicate failed.' }

  if ((srcLabels ?? []).length > 0) {
    await supabase.from('task_labels').insert(
      (srcLabels ?? []).map((l) => ({ task_id: clone.id, label_id: l.label_id }))
    )
  }
  if ((srcChecklist ?? []).length > 0) {
    await supabase.from('task_checklist_items').insert(
      (srcChecklist ?? []).map((c) => ({
        task_id: clone.id, text: c.text, is_done: false, sort_order: c.sort_order
      }))
    )
  }
  // Always add a 'parent' dep from clone -> source so the duplication is traceable.
  await supabase.from('task_dependencies').insert({
    company_id: member.companyId,
    task_id: clone.id,
    depends_on_task_id: src.id,
    kind: 'parent'
  })

  await logActivity(supabase, member.companyId, member.id, 'task.duplicated', 'task', clone.id, { sourceId: taskId })
  revalidatePath('/dashboard')
  return { task: toCamelTask(clone) }
}

// ─── Comments ─────────────────────────────────────────────────────────────

export async function addComment(taskId: string, body: string, mentions?: string[]) {
  const gate = await ensureTaskAccess(taskId, 'commenter')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({
      company_id: member.companyId,
      task_id: taskId,
      author_id: member.id,
      body,
      mentions: mentions ?? []
    })
    .select('*').single()
  if (error || !comment) return { error: error?.message ?? 'Comment failed.' }

  // Mention = implicit watcher invite (Slice B follow-up). For every
  // teammate the comment @-mentions, ensure they're recorded as a watcher
  // so their dashboard pulls the task into view via the watcher union.
  // Skipping cases that don't need an entry: the author themselves, the
  // special 'team' target, the current assignee (already sees it), and
  // admins / leads (they already see everything in the company).
  const mentionMemberIds = (mentions ?? []).filter(
    (id) => id && id !== 'team' && id !== member.id
  )
  if (mentionMemberIds.length > 0) {
    const { data: task } = await supabase
      .from('tasks')
      .select('assignee_id')
      .eq('id', taskId)
      .eq('company_id', member.companyId)
      .maybeSingle()
    const { data: candidates } = await supabase
      .from('team_members')
      .select('id, access_tier')
      .eq('company_id', member.companyId)
      .in('id', mentionMemberIds)
    const toWatch = (candidates ?? []).filter(
      (m) =>
        m.access_tier === 'member' &&
        m.id !== (task?.assignee_id ?? null)
    )
    if (toWatch.length > 0) {
      await supabase.from('task_watchers').upsert(
        toWatch.map((m) => ({
          task_id: taskId,
          member_id: m.id,
          invited_by: member.id
        })),
        { onConflict: 'task_id,member_id', ignoreDuplicates: true }
      )
    }
  }

  // Fan out web-push + email to mentioned members (best-effort, never
  // block the comment). The mention list is already deduped client-side;
  // we still drop the author and the 'team' target to avoid self-pings.
  if (mentionMemberIds.length > 0) {
    const { data: taskRow } = await supabase
      .from('tasks')
      .select('ref, title')
      .eq('id', taskId)
      .maybeSingle()
    if (taskRow?.ref) {
      const trimmedBody = body.length > 140 ? `${body.slice(0, 137)}...` : body
      const taskUrl = absoluteUrl(`/share/${taskRow.ref}`)
      const [{ data: recipients }, { data: prefs }] = await Promise.all([
        supabase
          .from('team_members')
          .select('id, full_name, contact_email, email')
          .in('id', mentionMemberIds),
        supabase
          .from('notification_email_prefs')
          .select('member_id, mentions')
          .in('member_id', mentionMemberIds)
      ])
      const prefMap = new Map(
        (prefs ?? []).map((p) => [p.member_id, p.mentions])
      )
      const recipMap = new Map((recipients ?? []).map((r) => [r.id, r]))

      await Promise.all(
        mentionMemberIds.map(async (id) => {
          await sendPushToMember(id, {
            title: `${member.fullName} mentioned you on ${taskRow.ref}`,
            body: trimmedBody,
            url: `/share/${taskRow.ref}`,
            tag: `task:${taskRow.ref}`
          }).catch(() => undefined)

          const allowed = prefMap.get(id) !== false
          if (!allowed) return
          const r = recipMap.get(id)
          if (!r) return
          const to = (r.contact_email && r.contact_email.trim()) || r.email
          if (!to) return
          const unsubscribeUrl = await buildUnsubscribeUrl(id)
          const { subject, html, text } = mentionEmail({
            recipientName: r.full_name,
            authorName: member.fullName,
            taskRef: taskRow.ref!,
            taskTitle: taskRow.title ?? '',
            commentBody: body,
            taskUrl,
            unsubscribeUrl
          })
          await sendEmail({
            to,
            subject,
            html,
            text,
            unsubscribeUrl,
            tag: 'mention'
          }).catch(() => undefined)
        })
      )
    }
  }

  await logActivity(supabase, member.companyId, member.id, 'comment.added', 'task', taskId)
  revalidatePath('/dashboard')
  return { comment }
}

export async function editComment(commentId: string, body: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const trimmed = body.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('task_comments')
    .select('author_id, task_id')
    .eq('id', commentId).eq('company_id', member.companyId).maybeSingle()
  if (!existing) return { error: 'Comment not found.' }

  const isAuthor = existing.author_id === member.id
  const isAdmin = member.accessTier === 'admin'
  if (!isAuthor && !isAdmin) return { error: 'Not allowed.' }

  await supabase
    .from('task_comments')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', commentId)

  await logActivity(supabase, member.companyId, member.id, 'comment.edited', 'task', existing.task_id)
  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function deleteComment(commentId: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('task_comments')
    .select('author_id, task_id')
    .eq('id', commentId).eq('company_id', member.companyId).maybeSingle()
  if (!existing) return { error: 'Comment not found.' }

  const isAuthor = existing.author_id === member.id
  const isAdmin = member.accessTier === 'admin'
  if (!isAuthor && !isAdmin) return { error: 'Not allowed.' }

  await supabase.from('task_comments').delete().eq('id', commentId)
  await logActivity(supabase, member.companyId, member.id, 'comment.deleted', 'task', existing.task_id)
  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── Checklist ────────────────────────────────────────────────────────────

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  await supabase.from('task_checklist_items').update({ is_done: isDone }).eq('id', itemId)
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function addChecklistItem(taskId: string, text: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: last } = await supabase
    .from('task_checklist_items').select('sort_order')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  await supabase
    .from('task_checklist_items')
    .insert({ task_id: taskId, text, sort_order: (last?.sort_order ?? 0) + 1 })

  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── Sprint CRUD ──────────────────────────────────────────────────────────

const IsoDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const SprintStatusEnum = z.enum(['upcoming', 'current', 'completed'])

const CreateSprintInput = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000).optional().nullable(),
    docUrl: z.string().trim().url().max(500).optional().nullable(),
    fromDate: IsoDateStr,
    toDate: IsoDateStr,
    status: SprintStatusEnum.optional()
  })
  .refine((v) => v.fromDate <= v.toDate, {
    message: 'fromDate must be on or before toDate', path: ['toDate']
  })

const UpdateSprintInput = z
  .object({
    sprintId: z.string().uuid(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    docUrl: z.string().trim().url().max(500).nullable().optional(),
    fromDate: IsoDateStr.optional(),
    toDate: IsoDateStr.optional(),
    status: SprintStatusEnum.optional()
  })
  .refine((v) => !v.fromDate || !v.toDate || v.fromDate <= v.toDate, {
    message: 'fromDate must be on or before toDate', path: ['toDate']
  })

export async function createSprint(input: z.input<typeof CreateSprintInput>) {
  const parsed = CreateSprintInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await requireAccessTier(['admin', 'lead'])
  const supabase = createAdminClient()

  const { data: project } = await supabase
    .from('projects').select('id')
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId).maybeSingle()
  if (!project) return { error: 'Project not found.' }

  const { data: last } = await supabase
    .from('sprints').select('number')
    .eq('project_id', project.id)
    .order('number', { ascending: false }).limit(1).maybeSingle()
  const nextNumber = (last?.number ?? 0) + 1

  const { data: sprint, error } = await supabase
    .from('sprints')
    .insert({
      company_id: member.companyId,
      project_id: project.id,
      number: nextNumber,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      doc_url: parsed.data.docUrl ?? null,
      status: parsed.data.status ?? 'upcoming',
      from_date: parsed.data.fromDate,
      to_date: parsed.data.toDate
    })
    .select('*').single()
  if (error || !sprint) return { error: error?.message ?? 'Create failed.' }

  revalidatePath('/dashboard')
  return { sprint }
}

export async function updateSprint(input: z.input<typeof UpdateSprintInput>) {
  const parsed = UpdateSprintInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await requireAccessTier(['admin', 'lead'])
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('sprints').select('id')
    .eq('id', parsed.data.sprintId).eq('company_id', member.companyId).maybeSingle()
  if (!existing) return { error: 'Sprint not found.' }

  const patch: Database['public']['Tables']['sprints']['Update'] = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.description !== undefined) patch.description = parsed.data.description
  if (parsed.data.docUrl !== undefined) patch.doc_url = parsed.data.docUrl
  if (parsed.data.fromDate) patch.from_date = parsed.data.fromDate
  if (parsed.data.toDate) patch.to_date = parsed.data.toDate
  if (parsed.data.status) patch.status = parsed.data.status

  await supabase.from('sprints').update(patch).eq('id', existing.id)
  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function deleteSprint(sprintId: string) {
  const parsed = z.string().uuid().safeParse(sprintId)
  if (!parsed.success) return { error: 'Invalid sprint id.' }
  const member = await requireAccessTier(['admin', 'lead'])
  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('sprints').delete({ count: 'exact' })
    .eq('id', parsed.data).eq('company_id', member.companyId)
  if (error) return { error: error.message }
  if ((count ?? 0) === 0) return { error: 'Sprint not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

const SprintTaskInput = z.object({
  sprintId: z.string().uuid(),
  taskId: z.string().uuid()
})

export async function addTaskToSprint(input: z.input<typeof SprintTaskInput>) {
  const parsed = SprintTaskInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const member = await requireAccessTier(['admin', 'lead'])
  if (!member) return { error: 'Only leads or admins can change sprint scope.' }
  const supabase = createAdminClient()

  const [sprintRes, taskRes] = await Promise.all([
    supabase.from('sprints').select('id')
      .eq('id', parsed.data.sprintId).eq('company_id', member.companyId).maybeSingle(),
    supabase.from('tasks').select('id')
      .eq('id', parsed.data.taskId).eq('company_id', member.companyId).maybeSingle()
  ])
  if (!sprintRes.data || !taskRes.data) return { error: 'Sprint or task not found.' }

  await supabase.from('sprint_tasks').upsert(
    { sprint_id: sprintRes.data.id, task_id: taskRes.data.id },
    { onConflict: 'sprint_id,task_id', ignoreDuplicates: true }
  )
  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function removeTaskFromSprint(input: z.input<typeof SprintTaskInput>) {
  const parsed = SprintTaskInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const member = await requireAccessTier(['admin', 'lead'])
  if (!member) return { error: 'Only leads or admins can change sprint scope.' }
  const supabase = createAdminClient()

  // company scoping via the parent sprint
  const { data: sprint } = await supabase
    .from('sprints').select('id')
    .eq('id', parsed.data.sprintId).eq('company_id', member.companyId).maybeSingle()
  if (!sprint) return { ok: true as const }

  await supabase
    .from('sprint_tasks').delete()
    .eq('sprint_id', parsed.data.sprintId).eq('task_id', parsed.data.taskId)
  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── Project github repo + external refs ──────────────────────────────────

const GithubRepoStr = z
  .string().trim()
  .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, 'expected "owner/repo" (e.g. verbivore/web)')
  .max(120)

const SetProjectRepoInput = z.object({
  projectId: z.string().uuid(),
  githubRepo: z.union([z.literal(''), GithubRepoStr])
})

export async function setProjectGithubRepo(input: z.input<typeof SetProjectRepoInput>) {
  const parsed = SetProjectRepoInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await requireAccessTier(['admin', 'lead'])
  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('projects').update({ github_repo: parsed.data.githubRepo || null }, { count: 'exact' })
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId)
  if (error) return { error: error.message }
  if ((count ?? 0) === 0) return { error: 'Project not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

const AddTaskExternalRefInput = z.object({
  taskId: z.string().uuid(),
  url: z.string().trim().url().max(2048),
  label: z.string().trim().min(1).max(120).optional().nullable()
})

export async function addTaskExternalRef(input: z.input<typeof AddTaskExternalRefInput>) {
  const parsed = AddTaskExternalRefInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const parsedUrl = parseExternalRef(parsed.data.url)
  if (!parsedUrl) return { error: 'Invalid URL.' }
  const supabase = createAdminClient()

  const { data: task } = await supabase
    .from('tasks').select('id')
    .eq('id', parsed.data.taskId).eq('company_id', member.companyId).maybeSingle()
  if (!task) return { error: 'Task not found.' }

  const providedLabel = parsed.data.label?.trim() || null
  const scrapedLabel = providedLabel ? null : await scrapeDocTitle(parsedUrl.url)
  const { data: ref, error } = await supabase
    .from('task_external_refs')
    .insert({
      company_id: member.companyId,
      task_id: task.id,
      kind: parsedUrl.kind,
      url: parsedUrl.url,
      label: providedLabel ?? scrapedLabel,
      created_by: member.id
    })
    .select('*').single()
  if (error || !ref) return { error: error?.message ?? 'Could not add reference.' }

  await logActivity(supabase, member.companyId, member.id, 'task.ref_added', 'task', task.id, {
    kind: parsedUrl.kind, url: parsedUrl.url
  })
  revalidatePath('/dashboard')
  return { ref: toCamelTaskRef(ref) }
}

export async function removeTaskExternalRef(refId: string) {
  const parsed = z.string().uuid().safeParse(refId)
  if (!parsed.success) return { error: 'Invalid ref id.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('task_external_refs').select('id, task_id, kind, url')
    .eq('id', parsed.data).eq('company_id', member.companyId).maybeSingle()
  if (!existing) return { error: 'Ref not found.' }

  const gate = await ensureTaskAccess(existing.task_id, 'owner')
  if ('error' in gate) return { error: gate.error }

  await supabase.from('task_external_refs').delete().eq('id', existing.id)
  await logActivity(supabase, member.companyId, member.id, 'task.ref_removed', 'task', existing.task_id, {
    kind: existing.kind, url: existing.url
  })
  revalidatePath('/dashboard')
  return { ok: true as const }
}

const AddProjectExternalRefInput = z.object({
  projectId: z.string().uuid(),
  url: z.string().trim().url().max(2048),
  label: z.string().trim().min(1).max(120).optional().nullable()
})

export async function addProjectExternalRef(input: z.input<typeof AddProjectExternalRefInput>) {
  const parsed = AddProjectExternalRefInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const parsedUrl = parseExternalRef(parsed.data.url)
  if (!parsedUrl) return { error: 'Invalid URL.' }
  const supabase = createAdminClient()

  const { data: project } = await supabase
    .from('projects').select('id')
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId).maybeSingle()
  if (!project) return { error: 'Project not found.' }

  const providedLabel = parsed.data.label?.trim() || null
  const scrapedLabel = providedLabel ? null : await scrapeDocTitle(parsedUrl.url)
  const { data: ref, error } = await supabase
    .from('project_external_refs')
    .insert({
      company_id: member.companyId,
      project_id: project.id,
      kind: parsedUrl.kind,
      url: parsedUrl.url,
      label: providedLabel ?? scrapedLabel,
      created_by: member.id
    })
    .select('*').single()
  if (error || !ref) return { error: error?.message ?? 'Could not add reference.' }

  revalidatePath('/dashboard')
  return { ref: toCamelProjectRef(ref) }
}

const UpdateExternalRefLabelInput = z.object({
  refId: z.string().uuid(),
  label: z.string().trim().max(120).nullable()
})

export async function updateProjectExternalRefLabel(
  input: z.input<typeof UpdateExternalRefLabelInput>
) {
  const parsed = UpdateExternalRefLabelInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const next = parsed.data.label && parsed.data.label.length > 0 ? parsed.data.label : null
  const { data: ref, error } = await supabase
    .from('project_external_refs')
    .update({ label: next })
    .eq('id', parsed.data.refId)
    .eq('company_id', member.companyId)
    .select('*')
    .single()
  if (error || !ref) return { error: error?.message ?? 'Ref not found.' }

  revalidatePath('/dashboard')
  return { ref: toCamelProjectRef(ref) }
}

export async function updateTaskExternalRefLabel(
  input: z.input<typeof UpdateExternalRefLabelInput>
) {
  const parsed = UpdateExternalRefLabelInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('task_external_refs').select('task_id')
    .eq('id', parsed.data.refId).eq('company_id', member.companyId).maybeSingle()
  if (!existing) return { error: 'Ref not found.' }
  const gate = await ensureTaskAccess(existing.task_id, 'owner')
  if ('error' in gate) return { error: gate.error }

  const next = parsed.data.label && parsed.data.label.length > 0 ? parsed.data.label : null
  const { data: ref, error } = await supabase
    .from('task_external_refs')
    .update({ label: next })
    .eq('id', parsed.data.refId)
    .eq('company_id', member.companyId)
    .select('*')
    .single()
  if (error || !ref) return { error: error?.message ?? 'Ref not found.' }

  revalidatePath('/dashboard')
  return { ref: toCamelTaskRef(ref) }
}

export async function removeProjectExternalRef(refId: string) {
  const parsed = z.string().uuid().safeParse(refId)
  if (!parsed.success) return { error: 'Invalid ref id.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('project_external_refs').delete({ count: 'exact' })
    .eq('id', parsed.data).eq('company_id', member.companyId)
  if (error) return { error: error.message }
  if ((count ?? 0) === 0) return { error: 'Ref not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── Handoff (drag-to-Done inline form) ──────────────────────────────────

const HandoffFieldsInput = z
  .object({
    whatItIs: z.string().trim().max(2000).optional().nullable(),
    currentStatus: z.string().trim().max(2000).optional().nullable(),
    doneSoFar: z.string().trim().max(2000).optional().nullable(),
    stillLeft: z.string().trim().max(2000).optional().nullable(),
    fileLinks: z.string().trim().max(2000).optional().nullable(),
    gotchas: z.string().trim().max(2000).optional().nullable(),
    whoToAsk: z.string().trim().max(2000).optional().nullable()
  })
  .partial()

const SubmitHandoffInput = z.object({
  taskId: z.string().uuid(),
  fields: HandoffFieldsInput
})

export async function fetchTaskHandoff(taskId: string) {
  const parsed = z.string().uuid().safeParse(taskId)
  if (!parsed.success) return { error: 'Invalid task id.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('handoffs')
    .select('what_it_is, current_status, done_so_far, still_left, file_links, gotchas, who_to_ask')
    .eq('task_id', parsed.data).eq('company_id', member.companyId).maybeSingle()

  return {
    handoff: row ? {
      whatItIs: row.what_it_is,
      currentStatus: row.current_status,
      doneSoFar: row.done_so_far,
      stillLeft: row.still_left,
      fileLinks: row.file_links,
      gotchas: row.gotchas,
      whoToAsk: row.who_to_ask
    } : null
  }
}

// Save partial handoff progress without validation. Used by the "Save
// draft" button so a user can fill the seven prompts across multiple
// sittings instead of one go. Does NOT touch task status - the member
// flips the column manually when they're ready.
export async function saveHandoffDraft(
  input: z.input<typeof SubmitHandoffInput>
): Promise<{ error: string } | { ok: true }> {
  const parsed = SubmitHandoffInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: task } = await supabase
    .from('tasks').select('id')
    .eq('id', parsed.data.taskId).eq('company_id', member.companyId).maybeSingle()
  if (!task) return { error: 'Task not found.' }

  await supabase.from('handoffs').upsert({
    company_id: member.companyId,
    task_id: task.id,
    from_member_id: member.id,
    status: 'in_progress',
    what_it_is: parsed.data.fields.whatItIs ?? null,
    current_status: parsed.data.fields.currentStatus ?? null,
    done_so_far: parsed.data.fields.doneSoFar ?? null,
    still_left: parsed.data.fields.stillLeft ?? null,
    file_links: parsed.data.fields.fileLinks ?? null,
    gotchas: parsed.data.fields.gotchas ?? null,
    who_to_ask: parsed.data.fields.whoToAsk ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'task_id' })

  revalidatePath('/dashboard')
  return { ok: true }
}

// Submit the handoff and mark it ready for review. Task status stays
// where it is - the member flips the column themselves when they're
// ready, which re-runs the gate and lets the task through cleanly.
export async function submitHandoffForReview(
  input: z.input<typeof SubmitHandoffInput>
): Promise<{ error: string; missing?: string[] } | { ok: true }> {
  const parsed = SubmitHandoffInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  const { data: task } = await supabase
    .from('tasks').select('id')
    .eq('id', parsed.data.taskId).eq('company_id', member.companyId).maybeSingle()
  if (!task) return { error: 'Task not found.' }

  const missing: string[] = []
  for (const field of HANDOFF_FIELDS) {
    const v = parsed.data.fields[field]
    if (!v || v.trim().length === 0) missing.push(field)
  }
  if (missing.length > 0) {
    return {
      error: `${missing.length} field${missing.length === 1 ? '' : 's'} still missing.`,
      missing
    }
  }

  await supabase.from('handoffs').upsert({
    company_id: member.companyId,
    task_id: task.id,
    from_member_id: member.id,
    status: 'ready_for_review',
    what_it_is: parsed.data.fields.whatItIs ?? null,
    current_status: parsed.data.fields.currentStatus ?? null,
    done_so_far: parsed.data.fields.doneSoFar ?? null,
    still_left: parsed.data.fields.stillLeft ?? null,
    file_links: parsed.data.fields.fileLinks ?? null,
    gotchas: parsed.data.fields.gotchas ?? null,
    who_to_ask: parsed.data.fields.whoToAsk ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'task_id' })

  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── Project CRUD (used by Panels.tsx) ────────────────────────────────────

const CreateProjectSchema = z.object({
  name: z.string().trim().min(2, { error: 'Name must be at least 2 characters.' }).max(80, { error: 'Name must be at most 80 characters.' }),
  kind: z.enum(['standard', 'operations'])
})
const ArchiveProjectSchema = z.object({ projectId: z.uuid() })
const RenameProjectSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(2, { error: 'Name must be at least 2 characters.' }).max(80, { error: 'Name must be at most 80 characters.' })
})

export async function createProjectInPlace(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(['admin', 'lead'])
  const parsed = CreateProjectSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind') ?? 'standard'
  })
  if (!parsed.success) return { error: 'Please enter a valid name (2 to 80 chars).' }
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('projects')
    .insert({ company_id: member.companyId, name: parsed.data.name, kind: parsed.data.kind })
  if (error) {
    const message = error.code === '23505'
      ? 'A project with that name already exists.'
      : "Couldn't create the project. Try again."
    return { error: message }
  }
  revalidatePath('/dashboard')
  return undefined
}

export async function archiveProjectInPlace(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(['admin', 'lead'])
  const parsed = ArchiveProjectSchema.safeParse({ projectId: formData.get('projectId') })
  if (!parsed.success) return { error: 'Invalid project id.' }
  const supabase = createAdminClient()
  await supabase.from('projects').update({ is_archived: true })
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId)
  revalidatePath('/dashboard')
  return undefined
}

export async function unarchiveProject(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(['admin', 'lead'])
  const parsed = ArchiveProjectSchema.safeParse({ projectId: formData.get('projectId') })
  if (!parsed.success) return { error: 'Invalid project id.' }
  const supabase = createAdminClient()
  await supabase.from('projects').update({ is_archived: false })
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId)
  revalidatePath('/dashboard')
  return undefined
}

export async function renameProject(formData: FormData): Promise<RenameProjectState> {
  const member = await requireAccessTier(['admin', 'lead'])
  const parsed = RenameProjectSchema.safeParse({
    projectId: formData.get('projectId'),
    name: formData.get('name')
  })
  if (!parsed.success) {
    return { error: 'Invalid input.', fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('projects').update({ name: parsed.data.name })
    .eq('id', parsed.data.projectId).eq('company_id', member.companyId)
  if (error) {
    const message = error.code === '23505'
      ? 'A project with that name already exists.'
      : "Couldn't rename the project. Try again."
    return { error: message }
  }
  revalidatePath('/dashboard')
  return undefined
}

// ─── Member portfolio (sidebar peek) ──────────────────────────────────────
// Fetches a teammate's profile fields for the right-side portfolio sheet.
// Scoped to the viewer's company. Read-only.
export async function fetchMemberPortfolio(memberId: string) {
  const viewer = await getCurrentTeamMember()
  if (!viewer) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select(
      'id, full_name, avatar_url, access_tier, bio, contact_email, headline, role_focus, timezone, work_style, languages, social_linkedin, social_instagram, social_whatsapp, work_links, skills'
    )
    .eq('id', memberId)
    .eq('company_id', viewer.companyId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Member not found.' }
  return {
    member: {
      id: data.id,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      accessTier: data.access_tier,
      bio: data.bio,
      contactEmail: data.contact_email,
      headline: data.headline,
      roleFocus: data.role_focus,
      timezone: data.timezone,
      workStyle: data.work_style,
      languages: data.languages ?? [],
      socialLinkedin: data.social_linkedin,
      socialInstagram: data.social_instagram,
      socialWhatsapp: data.social_whatsapp,
      workLinks: Array.isArray(data.work_links)
        ? (data.work_links as { label: string; url: string }[])
        : [],
      skills: Array.isArray(data.skills)
        ? (data.skills as { label: string; level: number }[])
        : []
    }
  }
}

// ─── Push notifications (Slice D) ────────────────────────────────────────
// Client subscribes via PushManager once the user enables notifications in
// Settings; the resulting subscription gets persisted here so we can fan
// out web-push messages from the server when mentions / assignments /
// invites land.
const SubscriptionInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().nullish()
})

export async function savePushSubscription(
  input: z.input<typeof SubscriptionInput>
) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const parsed = SubscriptionInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: parsed.data.endpoint,
      member_id: member.id,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null
    },
    { onConflict: 'endpoint' }
  )
  if (error) return { error: error.message }
  return { ok: true }
}

export async function deletePushSubscription(endpoint: string) {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  // member_id check stops a signed-in member from blowing away someone
  // else's subscription by guessing an endpoint.
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('member_id', member.id)
  return { ok: true }
}

export async function fetchPushPublicKey() {
  // Wrapped so the client can call it through the action surface without
  // exposing server-only modules.
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  return { publicKey: await getVapidPublicKey() }
}

// Diagnostic: pushes a test notification to every subscription belonging
// to the caller. Bypasses the self-skip that normally protects trigger
// actions so it can be invoked from the Settings toggle.
export async function sendSelfTestPush() {
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const result = await sendPushToMember(me.id, {
    title: 'Test notification',
    body: 'If you can see this, push delivery to this device works.',
    url: '/dashboard',
    tag: 'self-test'
  })
  return result
}

// ─── Member presence override ─────────────────────────────────────────────
// Admin / lead-only direct edit of another member's activity_status.
// Used from the sidebar right-click menu to mark someone on vacation /
// active / left without going through a full profile edit.
const UpdateActivityInput = z.object({
  memberId: z.string().uuid(),
  status: z.enum(['active', 'away', 'on_vacation', 'left'])
})

export async function updateMemberActivityStatus(
  input: z.input<typeof UpdateActivityInput>
) {
  const parsed = UpdateActivityInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const viewer = await requireAccessTier(['admin', 'lead'])
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update({ activity_status: parsed.data.status })
    .eq('id', parsed.data.memberId)
    .eq('company_id', viewer.companyId)
  if (error) return { error: error.message }
  await logActivity(
    supabase,
    viewer.companyId,
    viewer.id,
    'member.activity_changed',
    'member',
    parsed.data.memberId,
    { to: parsed.data.status }
  )
  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── Task watchers (Slice B: spectators) ──────────────────────────────────
// A watcher is a teammate who can view + comment on a task they aren't
// assigned to. Invite rights mirror the 'owner' gate (admin / lead /
// assignee). Watching is per-task; dependencies are not implied.
const AddWatcherInput = z.object({
  taskId: z.string().uuid(),
  memberId: z.string().uuid()
})

export async function addTaskWatcher(input: z.input<typeof AddWatcherInput>) {
  const parsed = AddWatcherInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
  if ('error' in gate) return { error: gate.error }
  const { member } = gate
  const supabase = createAdminClient()

  // Confirm the target lives in this company; rejects cross-tenant ids.
  const { data: target } = await supabase
    .from('team_members')
    .select('id, full_name')
    .eq('id', parsed.data.memberId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!target) return { error: 'Member not found.' }

  // Skip if the target is already the assignee - they already see it.
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id')
    .eq('id', parsed.data.taskId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!task) return { error: 'Task not found.' }
  if (task.assignee_id === parsed.data.memberId) {
    return { error: 'That member is already the assignee.' }
  }

  const { error } = await supabase
    .from('task_watchers')
    .upsert(
      {
        task_id: parsed.data.taskId,
        member_id: parsed.data.memberId,
        invited_by: member.id
      },
      { onConflict: 'task_id,member_id', ignoreDuplicates: true }
    )
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.watcher_added',
    'task',
    parsed.data.taskId,
    { memberId: parsed.data.memberId, memberName: target.full_name }
  )
  // Ping the new spectator (never yourself).
  if (parsed.data.memberId !== member.id) {
    const { data: t } = await supabase
      .from('tasks')
      .select('ref, title')
      .eq('id', parsed.data.taskId)
      .maybeSingle()
    if (t?.ref) {
      await sendPushToMember(parsed.data.memberId, {
        title: `Invited to watch ${t.ref}`,
        body: t.title ?? '',
        url: `/share/${t.ref}`,
        tag: `task:${t.ref}`
      }).catch(() => undefined)
    }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

const RemoveWatcherInput = z.object({
  taskId: z.string().uuid(),
  memberId: z.string().uuid()
})

export async function removeTaskWatcher(
  input: z.input<typeof RemoveWatcherInput>
) {
  const parsed = RemoveWatcherInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  // Watchers can remove themselves; everyone else needs owner-level access.
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  if (me.id !== parsed.data.memberId) {
    const gate = await ensureTaskAccess(parsed.data.taskId, 'owner')
    if ('error' in gate) return { error: gate.error }
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('task_watchers')
    .delete()
    .eq('task_id', parsed.data.taskId)
    .eq('member_id', parsed.data.memberId)
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'task.watcher_removed',
    'task',
    parsed.data.taskId,
    { memberId: parsed.data.memberId }
  )
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function listTaskWatchers(taskId: string) {
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_watchers')
    .select(
      'member_id, invited_at, invited_by, member:team_members!task_watchers_member_id_fkey(id, full_name, avatar_url, access_tier, slug)'
    )
    .eq('task_id', taskId)
    .order('invited_at', { ascending: true })
  if (error) return { error: error.message }
  return {
    watchers: (data ?? []).map((row) => {
      const m = Array.isArray(row.member) ? row.member[0] : row.member
      return {
        memberId: row.member_id,
        invitedBy: row.invited_by,
        invitedAt: row.invited_at,
        fullName: m?.full_name ?? '',
        avatarUrl: m?.avatar_url ?? null,
        accessTier: m?.access_tier ?? 'member',
        slug: m?.slug ?? null
      }
    })
  }
}
