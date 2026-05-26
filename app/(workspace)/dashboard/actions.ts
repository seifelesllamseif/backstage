'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentCrewMember, requireAccessTier } from '@/lib/dal'
import { parseExternalRef } from '@/lib/externalRef'
import { countMissingFields, isHandoffComplete } from '@/lib/handoff'
import type { TaskStatus, TaskPriority, RelationKind } from '@prisma/client'

// ─── Bulk-add input validation (decision 0025) ────────────────────────────
// Shared between client-side parser and this server action so a paste
// that passes parseBulkTaskJson also passes here. The schema is the
// contract; if it changes, both surfaces update together.
const TaskStatusEnum = z.enum([
  'backlog',
  'unscoped',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
  'duplicate'
])
const TaskPriorityEnum = z.enum(['urgent', 'high', 'medium', 'low', 'none'])
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const BulkDraftSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(500),
  description: z.string().nullish(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  assigneeId: z.string().uuid().nullish(),
  dueDate: IsoDate.nullish(),
  labelIds: z.array(z.string().uuid()).optional(),
  newLabelNames: z.array(z.string().trim().min(1).max(64)).optional()
})

const CreateBulkInputSchema = z.object({
  projectId: z.string().uuid('projectId must be a valid UUID'),
  drafts: z
    .array(BulkDraftSchema)
    .min(1, 'at least one task is required')
    .max(50, 'too many tasks in one batch — split into smaller groups')
})

// Shared shape for any status mutation that runs through the slice-2
// handoff gate (decision 0015, 0022). Keep this in sync with the
// slice-1 board's StatusChangeResult in projects/[id]/actions.ts —
// when 3b lands drag-and-drop, both surfaces consume this contract.
export type StatusChangeResult =
  | { ok: true }
  | {
      ok: false
      reason: 'handoff-incomplete' | 'generic'
      message: string
      missingCount?: number
      taskUrl?: string
    }

// ─── Types ────────────────────────────────────────────────────────────────

export type DashboardTask = Awaited<
  ReturnType<typeof fetchDashboardData>
>['tasks'][number]
export type DashboardMember = Awaited<
  ReturnType<typeof fetchDashboardData>
>['members'][number]
export type DashboardProject = Awaited<
  ReturnType<typeof fetchDashboardData>
>['projects'][number]

// ─── Read ─────────────────────────────────────────────────────────────────

export async function fetchDashboardData(projectId?: string) {
  const member = await getCurrentCrewMember()
  if (!member) throw new Error('Not signed in.')

  const isAdmin = member.accessTier === 'admin'

  // Non-admins see only "their projects" — projects where they have ≥1
  // assigned task. There's no ProjectMember table yet, so project
  // membership is derived from task assignments. Admins see everything.
  let myProjectIds: string[] | null = null
  if (!isAdmin) {
    const rows = await prisma.task.findMany({
      where: { companyId: member.companyId, assigneeId: member.id },
      select: { projectId: true },
      distinct: ['projectId']
    })
    myProjectIds = rows.map((r) => r.projectId)
    // If the URL asks for a project the member isn't on, lock the scope
    // to an empty set so they see nothing for it (no information leak).
    if (projectId && !myProjectIds.includes(projectId)) {
      myProjectIds = []
    }
  }

  // Effective project filter for the tasks query: URL projectId narrows
  // further within the scope; for non-admins, scope is myProjectIds.
  const projectFilter: { projectId?: string | { in: string[] } } = projectId
    ? { projectId }
    : myProjectIds !== null
      ? { projectId: { in: myProjectIds } }
      : {}

  const taskWhere = {
    companyId: member.companyId,
    ...projectFilter
  }

  // Tasks first — we use their assigneeIds to derive the "project team"
  // and their ids to scope activity/comments. At current scale this serial
  // step costs a few ms; we get correctness in exchange.
  const tasks = await prisma.task.findMany({
    where: taskWhere,
    include: {
      assignee: {
        select: {
          id: true,
          fullName: true,
          avatarInitials: true,
          avatarUrl: true,
          accessTier: true
        }
      },
      project: { select: { id: true, name: true } },
      labels: { include: { label: true } },
      checklist: { orderBy: { sortOrder: 'asc' } },
      depsOut: {
        include: {
          dependsOn: { select: { id: true, ref: true, title: true } }
        }
      },
      depsIn: {
        include: {
          task: { select: { id: true, ref: true, title: true } }
        }
      },
      cycleTasks: {
        include: { cycle: { select: { id: true, name: true } } }
      }
    },
    // Within-column ordering: explicit sortOrder first (3b drag/drop),
    // createdAt as fallback for rows that pre-date the migration.
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  })

  const taskIds = tasks.map((t) => t.id)

  // "Project team" for non-admins: distinct assignees on the visible
  // tasks, always including the current member so they can see themselves
  // in pickers even before they're assigned anything.
  const teamMemberIds = new Set<string>([member.id])
  for (const t of tasks) if (t.assigneeId) teamMemberIds.add(t.assigneeId)

  const [
    members,
    projects,
    allActiveProjects,
    labels,
    cycles,
    comments,
    activity,
    externalRefs,
    projectExternalRefs
  ] = await Promise.all([
      prisma.crewMember.findMany({
        where: {
          companyId: member.companyId,
          ...(myProjectIds !== null ? { id: { in: [...teamMemberIds] } } : {})
        },
        select: {
          id: true,
          fullName: true,
          avatarInitials: true,
          avatarUrl: true,
          accessTier: true
        },
        orderBy: { fullName: 'asc' }
      }),
      prisma.project.findMany({
        where: {
          companyId: member.companyId,
          ...(myProjectIds !== null ? { id: { in: myProjectIds } } : {})
        },
        select: {
          id: true,
          name: true,
          kind: true,
          isArchived: true,
          githubRepo: true
        },
        orderBy: [{ isArchived: 'asc' }, { name: 'asc' }]
      }),
      // Full active-project list, ignoring the per-member task scoping. Used
      // by the bulk-add picker so a member with no tasks yet can still pick
      // a target project to create *into*. The scoped `projects` above still
      // drives breadcrumb / panels / view filters — this list is write-only.
      prisma.project.findMany({
        where: { companyId: member.companyId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      }),
      prisma.label.findMany({
        where: { companyId: member.companyId },
        orderBy: { name: 'asc' }
      }),
      prisma.cycle.findMany({
        where: {
          companyId: member.companyId,
          ...(projectId
            ? { projectId }
            : myProjectIds !== null
              ? { projectId: { in: myProjectIds } }
              : {})
        },
        include: { tasks: { select: { taskId: true } } },
        orderBy: [{ status: 'asc' }, { number: 'desc' }]
      }),
      // Comments + activity scoped to the visible task set, so non-admins
      // never load rows for tasks outside their projects.
      prisma.taskComment.findMany({
        where: {
          companyId: member.companyId,
          taskId: { in: taskIds }
        },
        include: {
          author: {
            select: { id: true, fullName: true, avatarInitials: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // activity_log.entity_id isn't a true FK (generic string), but the
      // (entityType, entityId) index makes the IN lookup efficient.
      prisma.activityLog.findMany({
        where: {
          companyId: member.companyId,
          entityType: 'task',
          entityId: { in: taskIds }
        },
        include: {
          actor: {
            select: { id: true, fullName: true, avatarInitials: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // External refs (PR / issue / commit / doc / link) scoped to the
      // visible task set. Like comments + activity, they ride along with
      // their parent task — no separate fetch on detail open.
      prisma.taskExternalRef.findMany({
        where: {
          companyId: member.companyId,
          taskId: { in: taskIds }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Project-level external refs (audit trackers, brief docs, etc).
      // Scoped to the same project visibility window as `projects` above.
      prisma.projectExternalRef.findMany({
        where: {
          companyId: member.companyId,
          ...(myProjectIds !== null
            ? { projectId: { in: myProjectIds } }
            : {})
        },
        orderBy: { createdAt: 'asc' }
      })
    ])

  return {
    tasks,
    members,
    projects,
    allActiveProjects,
    labels,
    cycles,
    comments,
    activity,
    externalRefs,
    projectExternalRefs,
    currentMember: member
  }
}

// ─── Task Mutations ───────────────────────────────────────────────────────

export async function createDashboardTask(data: {
  title: string
  status?: TaskStatus
  priority?: TaskPriority
  projectId: string
  assigneeId?: string | null
  dueDate?: string | null
  labelIds?: string[]
}) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  // Generate sequential ref
  const lastTask = await prisma.task.findFirst({
    where: { projectId: data.projectId },
    orderBy: { seqNumber: 'desc' },
    select: { seqNumber: true }
  })
  const nextSeq = (lastTask?.seqNumber ?? 0) + 1

  const project = await prisma.project.findFirst({
    where: { id: data.projectId, companyId: member.companyId },
    select: { name: true }
  })
  if (!project) return { error: 'Project not found.' }

  // Generate ref prefix from project name (first word, uppercase, max 4 chars)
  const prefix = project.name.split(/\s+/)[0].toUpperCase().slice(0, 4)
  const ref = `${prefix}-${nextSeq}`

  const task = await prisma.task.create({
    data: {
      companyId: member.companyId,
      projectId: data.projectId,
      title: data.title,
      status: data.status ?? 'backlog',
      priority: data.priority ?? 'none',
      ref,
      seqNumber: nextSeq,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: member.id,
      labels: data.labelIds?.length
        ? { create: data.labelIds.map((labelId) => ({ labelId })) }
        : undefined
    }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.created',
    'task',
    task.id
  )
  revalidatePath('/dashboard')
  return { task }
}

// Bulk-create N tasks in one shot. Used by the "From AI" tab in the New
// Task modal: the user pastes structured JSON parsed on the client, and
// this action persists each row. Sequential ref generation per project
// (same prefix logic as createDashboardTask), labels attached via
// nested create. Wrapped in a transaction so a partial failure rolls
// back the whole batch — easier mental model than half-created tasks.
// See decision 0025.
export async function createBulkDashboardTasks(
  projectId: string,
  drafts: z.input<typeof BulkDraftSchema>[]
) {
  const validated = CreateBulkInputSchema.safeParse({ projectId, drafts })
  if (!validated.success) {
    const first = validated.error.issues[0]
    const path = first.path
      .map((seg) => (typeof seg === 'number' ? `[${seg}]` : `.${String(seg)}`))
      .join('')
      .replace(/^\./, '')
    return {
      error: path ? `${path}: ${first.message}` : first.message
    }
  }
  const { drafts: validDrafts } = validated.data

  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: member.companyId },
    select: { name: true }
  })
  if (!project) return { error: 'Project not found.' }

  const prefix = project.name.split(/\s+/)[0].toUpperCase().slice(0, 4)

  const lastTask = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { seqNumber: 'desc' },
    select: { seqNumber: true }
  })
  let nextSeq = (lastTask?.seqNumber ?? 0) + 1

  // Collect every distinct new label name across drafts. Preserve the
  // first-seen casing for display, key on lowercase for dedupe.
  const newLabelDisplayByLower = new Map<string, string>()
  for (const d of validDrafts) {
    for (const raw of d.newLabelNames ?? []) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (!newLabelDisplayByLower.has(key)) {
        newLabelDisplayByLower.set(key, trimmed)
      }
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    // Upsert each new label first so we can attach by id. (`@@unique(
    // companyId, name)` makes this safe even under concurrent paste-
    // submits, and `findFirst` lets us match case-insensitively before
    // creating to avoid "design" + "Design" duplicates.)
    const newLabelIdByLower = new Map<string, string>()
    for (const [key, display] of newLabelDisplayByLower) {
      const existing = await tx.label.findFirst({
        where: {
          companyId: member.companyId,
          name: { equals: display, mode: 'insensitive' }
        },
        select: { id: true }
      })
      if (existing) {
        newLabelIdByLower.set(key, existing.id)
      } else {
        const fresh = await tx.label.create({
          data: { companyId: member.companyId, name: display },
          select: { id: true }
        })
        newLabelIdByLower.set(key, fresh.id)
      }
    }

    const out: { id: string; ref: string }[] = []
    for (const d of validDrafts) {
      const seq = nextSeq++
      const ref = `${prefix}-${seq}`
      // Merge resolved label IDs with newly-created label IDs, dedup'd.
      const labelIds = new Set<string>(d.labelIds ?? [])
      for (const raw of d.newLabelNames ?? []) {
        const id = newLabelIdByLower.get(raw.trim().toLowerCase())
        if (id) labelIds.add(id)
      }
      const task = await tx.task.create({
        data: {
          companyId: member.companyId,
          projectId,
          title: d.title,
          description: d.description ?? undefined,
          status: d.status ?? 'backlog',
          priority: d.priority ?? 'none',
          ref,
          seqNumber: seq,
          assigneeId: d.assigneeId ?? null,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          createdBy: member.id,
          labels:
            labelIds.size > 0
              ? { create: [...labelIds].map((labelId) => ({ labelId })) }
              : undefined
        },
        select: { id: true, ref: true }
      })
      await tx.activityLog.create({
        data: {
          companyId: member.companyId,
          actorId: member.id,
          action: 'task.created',
          entityType: 'task',
          entityId: task.id
        }
      })
      out.push({ id: task.id, ref: task.ref ?? ref })
    }
    return {
      tasks: out,
      createdLabels: [...newLabelDisplayByLower.values()]
    }
  })

  revalidatePath('/dashboard')
  return created
}

export async function updateDashboardTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<StatusChangeResult> {
  const member = await getCurrentCrewMember()
  if (!member) {
    return { ok: false, reason: 'generic', message: 'Not signed in.' }
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    select: {
      id: true,
      projectId: true,
      status: true,
      handoff: {
        select: {
          whatItIs: true,
          currentStatus: true,
          doneSoFar: true,
          stillLeft: true,
          fileLinks: true,
          gotchas: true,
          whoToAsk: true
        }
      }
    }
  })
  if (!task) {
    return { ok: false, reason: 'generic', message: 'Task not found.' }
  }

  // Done gate (slice-2 invariant, decision 0015).
  if (status === 'done' && task.status !== 'done') {
    if (!isHandoffComplete(task.handoff)) {
      const missing = countMissingFields(task.handoff)
      return {
        ok: false,
        reason: 'handoff-incomplete',
        message: task.handoff
          ? `Fill ${missing} more handoff field${missing === 1 ? '' : 's'} before moving to Done.`
          : 'Start a handoff and fill all 7 fields before moving to Done.',
        missingCount: missing,
        taskUrl: `/projects/${task.projectId}/tasks/${task.id}`
      }
    }
  }

  const prevStatus = task.status
  await prisma.task.update({
    where: { id: task.id },
    data: { status }
  })

  // No-op when prev === next so we don't log a meaningless "from X to X".
  if (prevStatus !== status) {
    await logActivity(
      member.companyId,
      member.id,
      'task.status_changed',
      'task',
      task.id,
      { from: prevStatus, to: status }
    )
  }
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${task.projectId}`)
  return { ok: true }
}

export async function updateDashboardTaskPriority(
  taskId: string,
  priority: TaskPriority
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const prev = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    select: { priority: true }
  })
  if (!prev) return { error: 'Task not found.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { priority }
  })

  if (prev.priority !== priority) {
    await logActivity(
      member.companyId,
      member.id,
      'task.priority_changed',
      'task',
      taskId,
      { from: prev.priority, to: priority }
    )
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskAssignee(
  taskId: string,
  assigneeId: string | null
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const prev = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    select: {
      assigneeId: true,
      assignee: { select: { fullName: true } }
    }
  })
  if (!prev) return { error: 'Task not found.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId }
  })

  if (prev.assigneeId !== assigneeId) {
    const toName = assigneeId
      ? ((
          await prisma.crewMember.findUnique({
            where: { id: assigneeId },
            select: { fullName: true }
          })
        )?.fullName ?? null)
      : null
    await logActivity(
      member.companyId,
      member.id,
      'task.assignee_changed',
      'task',
      taskId,
      {
        from: prev.assigneeId,
        fromName: prev.assignee?.fullName ?? null,
        to: assigneeId,
        toName
      }
    )
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Drag-and-drop endpoint. Handles both within-column reorder (toStatus
// equals the current status) and cross-column move (toStatus differs).
// Routes through the same slice-2 handoff gate as updateDashboardTaskStatus
// when toStatus === 'done' — decision 0015, 0022.
//
// sort_order strategy: integer-renumber the destination column to
// [0, STEP, 2*STEP, …] on every move. O(n) writes per drop where n is
// destination column size. Trivial at Verbivorescale (≤10 cards/column).
// If columns grow large this becomes a float-midpoint problem; defer
// until measured.
const SORT_STEP = 1024

export async function moveDashboardTask(
  taskId: string,
  toStatus: TaskStatus,
  toIndex: number
): Promise<StatusChangeResult> {
  const member = await getCurrentCrewMember()
  if (!member) {
    return { ok: false, reason: 'generic', message: 'Not signed in.' }
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    select: {
      id: true,
      projectId: true,
      status: true,
      handoff: {
        select: {
          whatItIs: true,
          currentStatus: true,
          doneSoFar: true,
          stillLeft: true,
          fileLinks: true,
          gotchas: true,
          whoToAsk: true
        }
      }
    }
  })
  if (!task) {
    return { ok: false, reason: 'generic', message: 'Task not found.' }
  }

  // Done gate — slice-2 invariant (decision 0015).
  if (toStatus === 'done' && task.status !== 'done') {
    if (!isHandoffComplete(task.handoff)) {
      const missing = countMissingFields(task.handoff)
      return {
        ok: false,
        reason: 'handoff-incomplete',
        message: task.handoff
          ? `Fill ${missing} more handoff field${missing === 1 ? '' : 's'} before moving to Done.`
          : 'Start a handoff and fill all 7 fields before moving to Done.',
        missingCount: missing,
        taskUrl: `/projects/${task.projectId}/tasks/${task.id}`
      }
    }
  }

  // Load the destination column's current order. If the task is moving
  // within its own column we still pull it (it's in the snapshot below).
  // Scope by companyId only — the dashboard is multi-project; reordering
  // doesn't change which project a task belongs to.
  const columnTasks = await prisma.task.findMany({
    where: {
      companyId: member.companyId,
      status: toStatus,
      id: { not: task.id }
    },
    select: { id: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  })

  // Insert taskId at toIndex (clamped) in the destination order, then
  // renumber the whole column at SORT_STEP intervals.
  const clampedIndex = Math.max(0, Math.min(toIndex, columnTasks.length))
  const newOrder = [
    ...columnTasks.slice(0, clampedIndex).map((t) => t.id),
    task.id,
    ...columnTasks.slice(clampedIndex).map((t) => t.id)
  ]

  await prisma.$transaction([
    // Status change goes on the moved row only.
    prisma.task.update({
      where: { id: task.id },
      data: { status: toStatus }
    }),
    // Renumber the destination column.
    ...newOrder.map((id, i) =>
      prisma.task.update({
        where: { id },
        data: { sortOrder: i * SORT_STEP }
      })
    )
  ])

  // Only log status_changed if status actually moved (avoid log spam on
  // within-column reorders).
  if (toStatus !== task.status) {
    await logActivity(
      member.companyId,
      member.id,
      'task.status_changed',
      'task',
      task.id,
      { from: task.status, to: toStatus }
    )
  }
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${task.projectId}`)
  return { ok: true }
}

export async function deleteDashboardTask(taskId: string) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.task.delete({ where: { id: taskId } })

  await logActivity(member.companyId, member.id, 'task.deleted', 'task', taskId)
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function duplicateDashboardTask(taskId: string) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const src = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    include: { labels: true, checklist: true }
  })
  if (!src) return { error: 'Task not found.' }

  const lastTask = await prisma.task.findFirst({
    where: { projectId: src.projectId },
    orderBy: { seqNumber: 'desc' },
    select: { seqNumber: true }
  })
  const nextSeq = (lastTask?.seqNumber ?? 0) + 1

  const project = await prisma.project.findFirst({
    where: { id: src.projectId },
    select: { name: true }
  })
  const prefix = (project?.name ?? 'TASK')
    .split(/\s+/)[0]
    .toUpperCase()
    .slice(0, 4)
  const ref = `${prefix}-${nextSeq}`

  const clone = await prisma.task.create({
    data: {
      companyId: member.companyId,
      projectId: src.projectId,
      title: `${src.title} (copy)`,
      status: src.status,
      // Slot the clone immediately after the source in its column.
      // Board order is [sortOrder asc, createdAt desc] — +1 lands the
      // clone between source and the next card in the SORT_STEP gap.
      // Null source.sortOrder (pre-migration rows) leaves clone null;
      // the createdAt tiebreaker keeps it adjacent.
      sortOrder: src.sortOrder != null ? src.sortOrder + 1 : undefined,
      priority: src.priority,
      ref,
      seqNumber: nextSeq,
      assigneeId: src.assigneeId,
      dueDate: src.dueDate,
      createdBy: member.id,
      labels: src.labels.length
        ? { create: src.labels.map((l) => ({ labelId: l.labelId })) }
        : undefined,
      checklist: src.checklist.length
        ? {
            create: src.checklist.map((c) => ({
              text: c.text,
              isDone: false,
              sortOrder: c.sortOrder
            }))
          }
        : undefined,
      depsOut: {
        create: [
          {
            companyId: member.companyId,
            dependsOnTaskId: src.id,
            kind: 'parent' as RelationKind
          }
        ]
      }
    }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.duplicated',
    'task',
    clone.id,
    { sourceId: taskId }
  )
  revalidatePath('/dashboard')
  return { task: clone }
}

// ─── Comments ─────────────────────────────────────────────────────────────

export async function addComment(
  taskId: string,
  body: string,
  mentions?: string[]
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const comment = await prisma.taskComment.create({
    data: {
      companyId: member.companyId,
      taskId,
      authorId: member.id,
      body,
      mentions: mentions ?? []
    }
  })

  await logActivity(
    member.companyId,
    member.id,
    'comment.added',
    'task',
    taskId
  )
  revalidatePath('/dashboard')
  return { comment }
}

export async function editComment(commentId: string, body: string) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Comment cannot be empty.' }

  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, companyId: member.companyId },
    select: { authorId: true, taskId: true }
  })
  if (!existing) return { error: 'Comment not found.' }

  // Authz: author OR admin.
  const isAuthor = existing.authorId === member.id
  const isAdmin = member.accessTier === 'admin'
  if (!isAuthor && !isAdmin) return { error: 'Not allowed.' }

  await prisma.taskComment.update({
    where: { id: commentId },
    data: { body: trimmed, editedAt: new Date() }
  })

  await logActivity(
    member.companyId,
    member.id,
    'comment.edited',
    'task',
    existing.taskId
  )
  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function deleteComment(commentId: string) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, companyId: member.companyId },
    select: { authorId: true, taskId: true }
  })
  if (!existing) return { error: 'Comment not found.' }

  const isAuthor = existing.authorId === member.id
  const isAdmin = member.accessTier === 'admin'
  if (!isAuthor && !isAdmin) return { error: 'Not allowed.' }

  await prisma.taskComment.delete({ where: { id: commentId } })

  await logActivity(
    member.companyId,
    member.id,
    'comment.deleted',
    'task',
    existing.taskId
  )
  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── Checklist ────────────────────────────────────────────────────────────

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { isDone }
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function addChecklistItem(taskId: string, text: string) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const last = await prisma.taskChecklistItem.findFirst({
    where: { taskId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true }
  })

  await prisma.taskChecklistItem.create({
    data: {
      taskId,
      text,
      sortOrder: (last?.sortOrder ?? 0) + 1
    }
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

// ─── Cycle CRUD ───────────────────────────────────────────────────────────

const IsoDateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const CycleStatusEnum = z.enum(['upcoming', 'current', 'completed'])

const CreateCycleInput = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000).optional().nullable(),
    docUrl: z.string().trim().url().max(500).optional().nullable(),
    fromDate: IsoDateStr,
    toDate: IsoDateStr,
    status: CycleStatusEnum.optional()
  })
  .refine((v) => v.fromDate <= v.toDate, {
    message: 'fromDate must be on or before toDate',
    path: ['toDate']
  })

const UpdateCycleInput = z
  .object({
    cycleId: z.string().uuid(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    docUrl: z.string().trim().url().max(500).nullable().optional(),
    fromDate: IsoDateStr.optional(),
    toDate: IsoDateStr.optional(),
    status: CycleStatusEnum.optional()
  })
  .refine(
    (v) => !v.fromDate || !v.toDate || v.fromDate <= v.toDate,
    { message: 'fromDate must be on or before toDate', path: ['toDate'] }
  )

export async function createCycle(input: z.input<typeof CreateCycleInput>) {
  const parsed = CreateCycleInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await requireAccessTier(['admin', 'lead'])

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    select: { id: true }
  })
  if (!project) return { error: 'Project not found.' }

  // Per-project sequential number, matches the @@unique(projectId, number).
  const last = await prisma.cycle.findFirst({
    where: { projectId: project.id },
    orderBy: { number: 'desc' },
    select: { number: true }
  })
  const nextNumber = (last?.number ?? 0) + 1

  const cycle = await prisma.cycle.create({
    data: {
      companyId: member.companyId,
      projectId: project.id,
      number: nextNumber,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      docUrl: parsed.data.docUrl ?? null,
      status: parsed.data.status ?? 'upcoming',
      fromDate: new Date(parsed.data.fromDate),
      toDate: new Date(parsed.data.toDate)
    }
  })

  revalidatePath('/dashboard')
  return { cycle }
}

export async function updateCycle(input: z.input<typeof UpdateCycleInput>) {
  const parsed = UpdateCycleInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await requireAccessTier(['admin', 'lead'])

  const existing = await prisma.cycle.findFirst({
    where: { id: parsed.data.cycleId, companyId: member.companyId },
    select: { id: true }
  })
  if (!existing) return { error: 'Cycle not found.' }

  const patch: {
    name?: string
    description?: string | null
    docUrl?: string | null
    fromDate?: Date
    toDate?: Date
    status?: 'upcoming' | 'current' | 'completed'
  } = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description
  }
  if (parsed.data.docUrl !== undefined) patch.docUrl = parsed.data.docUrl
  if (parsed.data.fromDate) patch.fromDate = new Date(parsed.data.fromDate)
  if (parsed.data.toDate) patch.toDate = new Date(parsed.data.toDate)
  if (parsed.data.status) patch.status = parsed.data.status

  await prisma.cycle.update({
    where: { id: existing.id },
    data: patch
  })

  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function deleteCycle(cycleId: string) {
  const parsed = z.string().uuid().safeParse(cycleId)
  if (!parsed.success) return { error: 'Invalid cycle id.' }
  const member = await requireAccessTier(['admin', 'lead'])

  // updateMany scoping covers both ownership check and the rare race where
  // someone else just deleted it — no row updated, no throw.
  const res = await prisma.cycle.deleteMany({
    where: { id: parsed.data, companyId: member.companyId }
  })
  if (res.count === 0) return { error: 'Cycle not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

const CycleTaskInput = z.object({
  cycleId: z.string().uuid(),
  taskId: z.string().uuid()
})

export async function addTaskToCycle(
  input: z.input<typeof CycleTaskInput>
) {
  const parsed = CycleTaskInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  // Verify both rows belong to the caller's company before linking — same
  // pattern as task mutations: cross-company writes are silently dropped.
  const [cycle, task] = await Promise.all([
    prisma.cycle.findFirst({
      where: { id: parsed.data.cycleId, companyId: member.companyId },
      select: { id: true }
    }),
    prisma.task.findFirst({
      where: { id: parsed.data.taskId, companyId: member.companyId },
      select: { id: true }
    })
  ])
  if (!cycle || !task) return { error: 'Cycle or task not found.' }

  await prisma.cycleTask.upsert({
    where: { cycleId_taskId: { cycleId: cycle.id, taskId: task.id } },
    create: { cycleId: cycle.id, taskId: task.id },
    update: {}
  })

  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function removeTaskFromCycle(
  input: z.input<typeof CycleTaskInput>
) {
  const parsed = CycleTaskInput.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.cycleTask.deleteMany({
    where: {
      cycleId: parsed.data.cycleId,
      taskId: parsed.data.taskId,
      cycle: { companyId: member.companyId }
    }
  })

  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── External refs (project repo + task PR/issue/doc links) ──────────────

const GithubRepoStr = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/,
    'expected "owner/repo" (e.g. verbivore/web)'
  )
  .max(120)

const SetProjectRepoInput = z.object({
  projectId: z.string().uuid(),
  // Empty string clears the repo. Anything else must match owner/repo.
  githubRepo: z.union([z.literal(''), GithubRepoStr])
})

export async function setProjectGithubRepo(
  input: z.input<typeof SetProjectRepoInput>
) {
  const parsed = SetProjectRepoInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await requireAccessTier(['admin', 'lead'])

  const res = await prisma.project.updateMany({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    data: { githubRepo: parsed.data.githubRepo || null }
  })
  if (res.count === 0) return { error: 'Project not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

const AddTaskExternalRefInput = z.object({
  taskId: z.string().uuid(),
  url: z.string().trim().url().max(2048),
  label: z.string().trim().min(1).max(120).optional().nullable()
})

export async function addTaskExternalRef(
  input: z.input<typeof AddTaskExternalRefInput>
) {
  const parsed = AddTaskExternalRefInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const parsedUrl = parseExternalRef(parsed.data.url)
  if (!parsedUrl) return { error: 'Invalid URL.' }

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, companyId: member.companyId },
    select: { id: true }
  })
  if (!task) return { error: 'Task not found.' }

  const ref = await prisma.taskExternalRef.create({
    data: {
      companyId: member.companyId,
      taskId: task.id,
      kind: parsedUrl.kind,
      url: parsedUrl.url,
      label: parsed.data.label?.trim() || null,
      createdBy: member.id
    }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.ref_added',
    'task',
    task.id,
    { kind: parsedUrl.kind, url: parsedUrl.url }
  )

  revalidatePath('/dashboard')
  return { ref }
}

export async function removeTaskExternalRef(refId: string) {
  const parsed = z.string().uuid().safeParse(refId)
  if (!parsed.success) return { error: 'Invalid ref id.' }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const existing = await prisma.taskExternalRef.findFirst({
    where: { id: parsed.data, companyId: member.companyId },
    select: { id: true, taskId: true, kind: true, url: true }
  })
  if (!existing) return { error: 'Ref not found.' }

  await prisma.taskExternalRef.delete({ where: { id: existing.id } })

  await logActivity(
    member.companyId,
    member.id,
    'task.ref_removed',
    'task',
    existing.taskId,
    { kind: existing.kind, url: existing.url }
  )

  revalidatePath('/dashboard')
  return { ok: true as const }
}

const AddProjectExternalRefInput = z.object({
  projectId: z.string().uuid(),
  url: z.string().trim().url().max(2048),
  label: z.string().trim().min(1).max(120).optional().nullable()
})

export async function addProjectExternalRef(
  input: z.input<typeof AddProjectExternalRefInput>
) {
  const parsed = AddProjectExternalRefInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const parsedUrl = parseExternalRef(parsed.data.url)
  if (!parsedUrl) return { error: 'Invalid URL.' }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    select: { id: true }
  })
  if (!project) return { error: 'Project not found.' }

  const ref = await prisma.projectExternalRef.create({
    data: {
      companyId: member.companyId,
      projectId: project.id,
      kind: parsedUrl.kind,
      url: parsedUrl.url,
      label: parsed.data.label?.trim() || null,
      createdBy: member.id
    }
  })

  revalidatePath('/dashboard')
  return { ref }
}

export async function removeProjectExternalRef(refId: string) {
  const parsed = z.string().uuid().safeParse(refId)
  if (!parsed.success) return { error: 'Invalid ref id.' }
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  const res = await prisma.projectExternalRef.deleteMany({
    where: { id: parsed.data, companyId: member.companyId }
  })
  if (res.count === 0) return { error: 'Ref not found.' }

  revalidatePath('/dashboard')
  return { ok: true as const }
}

// ─── Activity Log (internal) ──────────────────────────────────────────────

async function logActivity(
  companyId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  await prisma.activityLog.create({
    data: {
      companyId,
      actorId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ? (metadata as object) : undefined
    }
  })
}
