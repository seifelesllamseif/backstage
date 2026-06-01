import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import type { Database, Json } from '@/supabase/types'

type TaskStatus = Database['public']['Enums']['task_status']
type TaskPriority = Database['public']['Enums']['task_priority']
type RelationKind = Database['public']['Enums']['relation_kind']
type AccessTier = Database['public']['Enums']['access_tier']
type ProjectKind = Database['public']['Enums']['project_kind']
type SprintStatus = Database['public']['Enums']['sprint_status']
type ExternalRefKind = Database['public']['Enums']['external_ref_kind']

// camelCase return shapes preserved from the Prisma era so the dashboard's
// mappers + UI keep working unchanged. Mirrors what fetchDashboardData used
// to return when it was 78 prisma calls deep.

interface MemberSummary {
  id: string
  fullName: string
  avatarUrl: string | null
  accessTier: AccessTier
}

interface ProjectSummary {
  id: string
  name: string
}

interface LabelSummary {
  id: string
  name: string
  color: string | null
}

interface ChecklistItemRow {
  id: string
  text: string
  isDone: boolean
  sortOrder: number
}

interface TaskRefSummary {
  id: string
  ref: string | null
  title: string
}

interface DepsOutRow {
  id: string
  kind: RelationKind
  dependsOn: TaskRefSummary | null
}

interface DepsInRow {
  id: string
  kind: RelationKind
  task: TaskRefSummary | null
}

interface SprintLink {
  sprint: { id: string; name: string } | null
}

export interface DashboardTaskRow {
  id: string
  ref: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  leadId: string | null
  projectId: string
  dueDate: string | null
  sortOrder: number | null
  seqNumber: number | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  assignee: MemberSummary | null
  lead: MemberSummary | null
  project: ProjectSummary | null
  labels: { label: LabelSummary | null }[]
  checklist: ChecklistItemRow[]
  depsOut: DepsOutRow[]
  depsIn: DepsInRow[]
  sprintTasks: SprintLink[]
}

export interface DashboardMemberRow {
  id: string
  fullName: string
  avatarUrl: string | null
  accessTier: AccessTier
  // URL-safe slug from team_members.slug. Powers readable filter URLs
  // (?assignee=asim-selim) and shareable per-member links.
  slug: string | null
  // Presence signals. last_seen_at is bumped from the workspace layout's
  // after() hook; activity_status is manually set (or stays 'active').
  // The UI derives the displayed badge from both via lib/presence.
  lastSeenAt: string | null
  activityStatus: Database['public']['Enums']['activity_status']
  // IANA timezone (e.g. "Europe/Malta"). Used to flag teammates who are
  // outside their work hours so we don't ping them at 11pm local.
  timezone: string | null
}

export interface DashboardProjectRow {
  id: string
  name: string
  kind: ProjectKind
  isArchived: boolean
  githubRepo: string | null
}

export interface DashboardLabelRow {
  id: string
  name: string
  color: string | null
}

export interface DashboardSprintRow {
  id: string
  projectId: string
  number: number
  name: string
  description: string | null
  docUrl: string | null
  status: SprintStatus
  fromDate: string
  toDate: string
  tasks: { taskId: string }[]
}

export interface DashboardCommentRow {
  id: string
  taskId: string
  body: string
  createdAt: string
  editedAt: string | null
  mentions: string[]
  author: { id: string; fullName: string } | null
}

export interface DashboardActivityRow {
  id: string
  entityId: string | null
  action: string
  createdAt: string
  metadata: Json
  actor: { id: string; fullName: string } | null
}

export interface DashboardTaskExternalRefRow {
  id: string
  taskId: string
  kind: ExternalRefKind
  url: string
  label: string | null
  createdAt: string
}

export interface DashboardProjectExternalRefRow {
  id: string
  projectId: string
  kind: ExternalRefKind
  url: string
  label: string | null
  createdAt: string
}

export interface DashboardData {
  tasks: DashboardTaskRow[]
  members: DashboardMemberRow[]
  projects: DashboardProjectRow[]
  allActiveProjects: { id: string; name: string }[]
  labels: DashboardLabelRow[]
  sprints: DashboardSprintRow[]
  comments: DashboardCommentRow[]
  activity: DashboardActivityRow[]
  externalRefs: DashboardTaskExternalRefRow[]
  projectExternalRefs: DashboardProjectExternalRefRow[]
  currentMember: {
    id: string
    companyId: string
    fullName: string
    accessTier: AccessTier
    onboardingComplete: boolean
  }
}

function toMember(row: {
  id: string
  full_name: string
  avatar_url: string | null
  access_tier: AccessTier
}): MemberSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    accessTier: row.access_tier
  }
}

export async function fetchDashboardData(
  projectId?: string
): Promise<DashboardData> {
  const member = await getCurrentTeamMember()
  if (!member) throw new Error('Not signed in.')

  // Admin client (service role) - bypasses RLS. Authz still enforced in app
  // code via getCurrentTeamMember() above and .eq('company_id', ...) filters
  // on every query. See supabase/admin.ts for the rationale.
  const supabase = createAdminClient()

  // Admins and leads see everything in the company. Members see only "their
  // projects" - projects where they have >=1 assigned task OR where they're
  // a watcher on a task (Slice B). There is no ProjectMember table yet, so
  // member-project membership is derived from task assignments + watchers.
  const seesAllProjects =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  let myProjectIds: string[] | null = null
  // Tasks the member is explicitly invited to watch. Used both in the task
  // query (`assignee_id == me OR id IN watcherTaskIds`) and to pull the
  // hosting projects into the scope.
  let watcherTaskIds: string[] = []
  if (!seesAllProjects) {
    const [assignedRes, watcherRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('project_id')
        .eq('company_id', member.companyId)
        .eq('assignee_id', member.id),
      supabase
        .from('task_watchers')
        .select('task_id, task:tasks!task_watchers_task_id_fkey(project_id)')
        .eq('member_id', member.id)
    ])
    if (assignedRes.error) throw assignedRes.error
    if (watcherRes.error) throw watcherRes.error
    const ids = new Set<string>()
    for (const r of assignedRes.data ?? []) ids.add(r.project_id)
    for (const r of watcherRes.data ?? []) {
      watcherTaskIds.push(r.task_id)
      const t = Array.isArray(r.task) ? r.task[0] : r.task
      if (t?.project_id) ids.add(t.project_id)
    }
    myProjectIds = [...ids]
    if (projectId && !myProjectIds.includes(projectId)) {
      myProjectIds = []
    }
  }

  // Effective project filter for the tasks query: URL projectId narrows
  // further within the scope; for non-admins, scope is myProjectIds.
  let taskQuery = supabase
    .from('tasks')
    .select('*')
    .eq('company_id', member.companyId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (projectId) {
    taskQuery = taskQuery.eq('project_id', projectId)
  } else if (myProjectIds !== null) {
    if (myProjectIds.length === 0) {
      taskQuery = taskQuery.in('project_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      taskQuery = taskQuery.in('project_id', myProjectIds)
    }
  }

  // Members see only tasks they're personally assigned OR tasks they've
  // been invited to watch (Slice B). Admins and leads still see the full
  // project. The two axes are unioned via PostgREST .or() so a single
  // query covers both cases.
  if (!seesAllProjects) {
    if (watcherTaskIds.length === 0) {
      taskQuery = taskQuery.eq('assignee_id', member.id)
    } else {
      taskQuery = taskQuery.or(
        `assignee_id.eq.${member.id},id.in.(${watcherTaskIds.join(',')})`
      )
    }
  }

  const { data: rawTasks, error: tasksError } = await taskQuery
  if (tasksError) throw tasksError
  const taskList = rawTasks ?? []
  const taskIds = taskList.map((t) => t.id)

  // Parallel fetches keyed on the visible task / project set.
  const projectScopeForSprintsAndRefs: string[] | null = projectId
    ? [projectId]
    : myProjectIds
  const safeProjectIds = (ids: string[]) =>
    ids.length === 0 ? ['00000000-0000-0000-0000-000000000000'] : ids
  const safeTaskIds = taskIds.length === 0
    ? ['00000000-0000-0000-0000-000000000000']
    : taskIds

  const [
    membersRes,
    projectsRes,
    allActiveProjectsRes,
    labelsRes,
    sprintsRes,
    sprintTasksRes,
    taskLabelsRes,
    checklistRes,
    depsRes,
    sprintTaskJoinForTasksRes,
    commentsRes,
    activityRes,
    externalRefsRes,
    projectExternalRefsRes,
    refTasksRes
  ] = await Promise.all([
    // members - always the full company team. Members previously got a
    // narrow slice (just the assignees / leads of their visible tasks),
    // which rendered "1 member" on every project card and made @-mention
    // pickers feel broken. The roster is small and read-only here, so we
    // hand it down whole and let the UI decide what to show.
    supabase
      .from('team_members')
      .select(
        'id, full_name, avatar_url, access_tier, slug, last_seen_at, activity_status, timezone'
      )
      .eq('company_id', member.companyId)
      .order('full_name', { ascending: true }),
    // projects - scoped to my projects for non-admins
    (() => {
      let q = supabase
        .from('projects')
        .select('id, name, kind, is_archived, github_repo')
        .eq('company_id', member.companyId)
        .order('is_archived', { ascending: true })
        .order('name', { ascending: true })
      if (myProjectIds !== null) {
        q = q.in('id', safeProjectIds(myProjectIds))
      }
      return q
    })(),
    // allActiveProjects - full active list, ignoring per-member scoping
    supabase
      .from('projects')
      .select('id, name')
      .eq('company_id', member.companyId)
      .eq('is_archived', false)
      .order('name', { ascending: true }),
    // labels - all company labels
    supabase
      .from('labels')
      .select('id, name, color')
      .eq('company_id', member.companyId)
      .order('name', { ascending: true }),
    // sprints - scoped to project visibility
    (() => {
      let q = supabase
        .from('sprints')
        .select('*')
        .eq('company_id', member.companyId)
        .order('status', { ascending: true })
        .order('number', { ascending: false })
      if (projectId) {
        q = q.eq('project_id', projectId)
      } else if (myProjectIds !== null) {
        q = q.in('project_id', safeProjectIds(myProjectIds))
      }
      return q
    })(),
    // sprint_tasks - all join rows for the sprints we fetched. We can't
    // pre-scope to sprint ids here because we haven't run that query yet,
    // so we fetch all join rows for the company-visible task set and
    // filter once we know the sprint ids.
    supabase
      .from('sprint_tasks')
      .select('sprint_id, task_id')
      .in('task_id', safeTaskIds),
    // task_labels join rows for visible tasks, including the label name
    supabase
      .from('task_labels')
      .select('task_id, label_id, labels!task_label_label_id_fkey(id, name, color)')
      .in('task_id', safeTaskIds),
    // checklist items for visible tasks
    supabase
      .from('task_checklist_items')
      .select('*')
      .in('task_id', safeTaskIds)
      .order('sort_order', { ascending: true }),
    // task_dependencies in both directions - one fetch, classify later
    supabase
      .from('task_dependencies')
      .select('*')
      .eq('company_id', member.companyId)
      .or(
        taskIds.length === 0
          ? 'task_id.eq.00000000-0000-0000-0000-000000000000'
          : `task_id.in.(${taskIds.join(',')}),depends_on_task_id.in.(${taskIds.join(',')})`
      ),
    // sprint_tasks again, this time scoped to give each task its sprint
    // links (used by mapTask for the sprint chip). Same data as
    // sprintTasksRes but with the sprint name fetched inline.
    supabase
      .from('sprint_tasks')
      .select('task_id, sprint:sprints!cycle_task_cycle_id_fkey(id, name)')
      .in('task_id', safeTaskIds),
    // comments scoped to visible tasks
    supabase
      .from('task_comments')
      .select('*, author:team_members!task_comment_author_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .in('task_id', safeTaskIds)
      .order('created_at', { ascending: true }),
    // activity log scoped to visible tasks (entity_id is generic, but
    // the (entity_type, entity_id) index makes the IN lookup efficient)
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .eq('entity_type', 'task')
      .in('entity_id', safeTaskIds)
      .order('created_at', { ascending: true }),
    // task external refs scoped to visible tasks
    supabase
      .from('task_external_refs')
      .select('*')
      .eq('company_id', member.companyId)
      .in('task_id', safeTaskIds)
      .order('created_at', { ascending: true }),
    // project external refs scoped to visible projects
    (() => {
      let q = supabase
        .from('project_external_refs')
        .select('*')
        .eq('company_id', member.companyId)
        .order('created_at', { ascending: true })
      if (myProjectIds !== null) {
        q = q.in('project_id', safeProjectIds(myProjectIds))
      }
      return q
    })(),
    // tiny lookup of (id, ref, title) for any task referenced by a
    // dependency row. Fetched up-front so depsOut/depsIn can stitch.
    supabase
      .from('tasks')
      .select('id, ref, title')
      .eq('company_id', member.companyId)
  ])

  // Surface the first non-null error so we don't ship a half-populated payload.
  const errors = [
    membersRes.error,
    projectsRes.error,
    allActiveProjectsRes.error,
    labelsRes.error,
    sprintsRes.error,
    sprintTasksRes.error,
    taskLabelsRes.error,
    checklistRes.error,
    depsRes.error,
    sprintTaskJoinForTasksRes.error,
    commentsRes.error,
    activityRes.error,
    externalRefsRes.error,
    projectExternalRefsRes.error,
    refTasksRes.error
  ].filter((e): e is NonNullable<typeof e> => !!e)
  if (errors.length > 0) throw errors[0]

  // ---- Build lookups for stitching ----------------------------------------

  const taskRefById = new Map<string, TaskRefSummary>()
  for (const r of refTasksRes.data ?? []) {
    taskRefById.set(r.id, { id: r.id, ref: r.ref, title: r.title })
  }

  // Sprint links per task id (for mapTask's sprint chip)
  const sprintLinksByTask = new Map<string, SprintLink[]>()
  for (const row of sprintTaskJoinForTasksRes.data ?? []) {
    // Supabase types the nested relation as either an object or an array;
    // single-FK joins always return an object at runtime.
    const sprint = (row.sprint as { id: string; name: string } | null) ?? null
    const list = sprintLinksByTask.get(row.task_id) ?? []
    list.push({ sprint })
    sprintLinksByTask.set(row.task_id, list)
  }

  // task_labels join: group by task id, resolve label
  const labelsByTask = new Map<string, { label: LabelSummary | null }[]>()
  for (const row of taskLabelsRes.data ?? []) {
    const label = (row.labels as LabelSummary | null) ?? null
    const list = labelsByTask.get(row.task_id) ?? []
    list.push({ label })
    labelsByTask.set(row.task_id, list)
  }

  // checklist items grouped by task id
  const checklistByTask = new Map<string, ChecklistItemRow[]>()
  for (const row of checklistRes.data ?? []) {
    const list = checklistByTask.get(row.task_id) ?? []
    list.push({
      id: row.id,
      text: row.text,
      isDone: row.is_done,
      sortOrder: row.sort_order
    })
    checklistByTask.set(row.task_id, list)
  }

  // dependencies: classify into out (task_id matches) and in (depends_on_task_id matches)
  const depsOutByTask = new Map<string, DepsOutRow[]>()
  const depsInByTask = new Map<string, DepsInRow[]>()
  for (const dep of depsRes.data ?? []) {
    // outbound: this task depends on something
    if (taskIds.includes(dep.task_id)) {
      const list = depsOutByTask.get(dep.task_id) ?? []
      list.push({
        id: dep.id,
        kind: dep.kind,
        dependsOn: taskRefById.get(dep.depends_on_task_id) ?? null
      })
      depsOutByTask.set(dep.task_id, list)
    }
    // inbound: something depends on this task
    if (taskIds.includes(dep.depends_on_task_id)) {
      const list = depsInByTask.get(dep.depends_on_task_id) ?? []
      list.push({
        id: dep.id,
        kind: dep.kind,
        task: taskRefById.get(dep.task_id) ?? null
      })
      depsInByTask.set(dep.depends_on_task_id, list)
    }
  }

  // member + project lookups for stitching inline on tasks
  const memberById = new Map<string, MemberSummary>()
  for (const m of membersRes.data ?? []) memberById.set(m.id, toMember(m))

  const projectById = new Map<string, ProjectSummary>()
  for (const p of projectsRes.data ?? []) {
    projectById.set(p.id, { id: p.id, name: p.name })
  }

  // ---- Final task assembly ------------------------------------------------

  const tasks: DashboardTaskRow[] = taskList.map((t) => ({
    id: t.id,
    ref: t.ref,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assignee_id,
    leadId: t.lead_id,
    projectId: t.project_id,
    dueDate: t.due_date,
    sortOrder: t.sort_order,
    seqNumber: t.seq_number,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    createdBy: t.created_by,
    assignee: t.assignee_id ? memberById.get(t.assignee_id) ?? null : null,
    lead: t.lead_id ? memberById.get(t.lead_id) ?? null : null,
    project: projectById.get(t.project_id) ?? null,
    labels: labelsByTask.get(t.id) ?? [],
    checklist: checklistByTask.get(t.id) ?? [],
    depsOut: depsOutByTask.get(t.id) ?? [],
    depsIn: depsInByTask.get(t.id) ?? [],
    sprintTasks: sprintLinksByTask.get(t.id) ?? []
  }))

  // ---- Sprints with their task ids ----------------------------------------

  const sprintTaskIdsBySprint = new Map<string, string[]>()
  for (const link of sprintTasksRes.data ?? []) {
    const list = sprintTaskIdsBySprint.get(link.sprint_id) ?? []
    list.push(link.task_id)
    sprintTaskIdsBySprint.set(link.sprint_id, list)
  }
  const sprints: DashboardSprintRow[] = (sprintsRes.data ?? []).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    number: s.number,
    name: s.name,
    description: s.description,
    docUrl: s.doc_url,
    status: s.status,
    fromDate: s.from_date,
    toDate: s.to_date,
    tasks: (sprintTaskIdsBySprint.get(s.id) ?? []).map((taskId) => ({ taskId }))
  }))

  // ---- Members / Projects / Labels (already camelCased above) -------------

  const members: DashboardMemberRow[] = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    fullName: m.full_name,
    avatarUrl: m.avatar_url,
    accessTier: m.access_tier,
    slug: m.slug,
    lastSeenAt: m.last_seen_at,
    activityStatus: m.activity_status,
    timezone: m.timezone
  }))

  const projects: DashboardProjectRow[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    isArchived: p.is_archived,
    githubRepo: p.github_repo
  }))

  const allActiveProjects = (allActiveProjectsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name
  }))

  const labels: DashboardLabelRow[] = (labelsRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color
  }))

  // ---- Comments + Activity + External refs --------------------------------

  const comments: DashboardCommentRow[] = (commentsRes.data ?? []).map((c) => {
    const author = c.author as { id: string; full_name: string } | null
    return {
      id: c.id,
      taskId: c.task_id,
      body: c.body,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      mentions: c.mentions,
      author: author ? { id: author.id, fullName: author.full_name } : null
    }
  })

  const activity: DashboardActivityRow[] = (activityRes.data ?? []).map((a) => {
    const actor = a.actor as { id: string; full_name: string } | null
    return {
      id: a.id,
      entityId: a.entity_id,
      action: a.action,
      createdAt: a.created_at,
      metadata: a.metadata,
      actor: actor ? { id: actor.id, fullName: actor.full_name } : null
    }
  })

  const externalRefs: DashboardTaskExternalRefRow[] = (
    externalRefsRes.data ?? []
  ).map((r) => ({
    id: r.id,
    taskId: r.task_id,
    kind: r.kind,
    url: r.url,
    label: r.label,
    createdAt: r.created_at
  }))

  const projectExternalRefs: DashboardProjectExternalRefRow[] = (
    projectExternalRefsRes.data ?? []
  ).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    kind: r.kind,
    url: r.url,
    label: r.label,
    createdAt: r.created_at
  }))

  return {
    tasks,
    members,
    projects,
    allActiveProjects,
    labels,
    sprints,
    comments,
    activity,
    externalRefs,
    projectExternalRefs,
    currentMember: {
      id: member.id,
      companyId: member.companyId,
      fullName: member.fullName,
      accessTier: member.accessTier,
      // Wizard bumps onboarding_step to 6 when the last step ("Your work")
      // saves or is skipped. Used by the dashboard to hide the sidebar
      // "Finish your profile" entry and move it into Settings.
      onboardingComplete: member.onboardingStep >= 6
    }
  }
}
