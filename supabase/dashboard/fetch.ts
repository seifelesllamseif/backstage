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
  carryCount: number
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
  // When the member's team_members row was created. Drives the
  // "welcome new joiners" rotation on the topbar wordmark.
  joinedAt: string
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
  goal: string | null
  description: string | null
  docUrl: string | null
  status: SprintStatus
  fromDate: string
  toDate: string
  startedAt: string | null
  closedAt: string | null
  shippedCount: number | null
  carriedCount: number | null
  tasks: { taskId: string; carryCount: number }[]
}

export interface DashboardReactionRow {
  id: string
  emoji: string
  memberId: string
  memberName: string | null
  createdAt: string
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
  // Emoji reactions grouped by their parent id (comment id / task id). One
  // entry per (parent, member, emoji) triple. UI groups by emoji client-side
  // to render pills with counts.
  commentReactionsByComment: Record<string, DashboardReactionRow[]>
  taskReactionsByTask: Record<string, DashboardReactionRow[]>
  activity: DashboardActivityRow[]
  // Team-management activity (presence/tier/profile/etc), scoped to the
  // viewer's company. Not bucketable by task, so it lives on its own.
  teamActivity: DashboardActivityRow[]
  // Meeting lifecycle events. Same companywide scope as teamActivity.
  meetingActivity: DashboardActivityRow[]
  // Task deletions (and restores). Pulled separately from `activity`
  // because by definition the row's entity_id no longer matches any
  // visible task. The title/ref/status snapshot lives in metadata.
  taskDeletionActivity: DashboardActivityRow[]
  // Sprint lifecycle events (sprint.started, sprint.ended). Scoped to the
  // viewer's visible projects so a member in project A doesn't see project
  // B's sprint announcements.
  sprintActivity: DashboardActivityRow[]
  externalRefs: DashboardTaskExternalRefRow[]
  projectExternalRefs: DashboardProjectExternalRefRow[]
  // Distinct assignee ids per project, computed across all tasks (not
  // scoped to the viewer's visible-task slice). Lets the Projects panel
  // show the real roster on each card even for members whose `tasks`
  // array only contains their own assignments.
  projectAssigneeIds: Record<string, string[]>
  currentMember: {
    id: string
    companyId: string
    fullName: string
    accessTier: AccessTier
    onboardingComplete: boolean
    isOwner: boolean
    watcherTaskIds: string[]
    quickMeetUrl: string | null
    timezone: string | null
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

  // Owner-of-company lookup. Drives the isOwner flag on currentMember
  // (used by the team management page to unlock owner-only powers).
  const { data: ownerRow } = await supabase
    .from('companies')
    .select('owner_id, quick_meet_url')
    .eq('id', member.companyId)
    .maybeSingle()
  const ownerId = ownerRow?.owner_id ?? null
  const quickMeetUrl = ownerRow?.quick_meet_url ?? null

  // Admins and leads see everything in the company. Members see only "their
  // projects": an explicit project_members row, OR >=1 assigned task, OR
  // watching a task there (Slice B). The derived halves predate the table
  // and are kept unioned with it, so adding the table took nothing away
  // from anyone who could already see a project.
  const seesAllProjects =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  let myProjectIds: string[] | null = null
  // Always fetch the viewer's watched task ids: members need them for
  // task scope (`assignee = me OR id IN watched`) and every role needs
  // them on the payload so the palette can offer a "watching" filter.
  const watcherRes = await supabase
    .from('task_watchers')
    .select('task_id, task:tasks!task_watchers_task_id_fkey(project_id)')
    .eq('member_id', member.id)
  if (watcherRes.error) throw watcherRes.error
  const watcherTaskIds: string[] = []
  const watcherProjectIds = new Set<string>()
  for (const r of watcherRes.data ?? []) {
    watcherTaskIds.push(r.task_id)
    const t = Array.isArray(r.task) ? r.task[0] : r.task
    if (t?.project_id) watcherProjectIds.add(t.project_id)
  }
  // Explicit membership. Fetched for every role — admins and leads skip the
  // scoping below, but the UI still needs to know which projects they are
  // formally on. It is also the axis that widens task visibility further
  // down: being put on a project shows you the whole project, where merely
  // holding a task there still shows you only your own work.
  const explicitRes = await supabase
    .from('project_members')
    .select('project_id')
    .eq('company_id', member.companyId)
    .eq('member_id', member.id)
  if (explicitRes.error) throw explicitRes.error
  const explicitProjectIds = new Set(
    (explicitRes.data ?? []).map((r) => r.project_id)
  )

  if (!seesAllProjects) {
    const assignedRes = await supabase
      .from('tasks')
      .select('project_id')
      .eq('company_id', member.companyId)
      .eq('assignee_id', member.id)
      .is('deleted_at', null)
    if (assignedRes.error) throw assignedRes.error
    const ids = new Set<string>(watcherProjectIds)
    for (const id of explicitProjectIds) ids.add(id)
    for (const r of assignedRes.data ?? []) ids.add(r.project_id)
    myProjectIds = [...ids]
    if (projectId && !myProjectIds.includes(projectId)) {
      myProjectIds = []
    }
  }

  // Tasks query: scope by role (members get only projects they're in)
  // but NOT by the URL ?project= filter. The dashboard filters down to
  // the active project client-side via visibleTasks, while command-palette
  // search and cross-project relations need the full role-scoped list.
  let taskQuery = supabase
    .from('tasks')
    .select('*')
    .eq('company_id', member.companyId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (myProjectIds !== null) {
    if (myProjectIds.length === 0) {
      taskQuery = taskQuery.in('project_id', [
        '00000000-0000-0000-0000-000000000000'
      ])
    } else {
      taskQuery = taskQuery.in('project_id', myProjectIds)
    }
  }

  // Members see tasks they're personally assigned, tasks they've been
  // invited to watch (Slice B), or anything inside a project they were
  // explicitly added to. Admins and leads still see the full company.
  //
  // That third axis is what makes explicit membership worth having: being
  // put on a project shows you the project's work, where merely holding a
  // task there keeps showing you only your own. The axes are unioned in one
  // PostgREST .or() so this stays a single query.
  if (!seesAllProjects) {
    const axes = [`assignee_id.eq.${member.id}`]
    if (watcherTaskIds.length > 0) {
      axes.push(`id.in.(${watcherTaskIds.join(',')})`)
    }
    if (explicitProjectIds.size > 0) {
      axes.push(`project_id.in.(${[...explicitProjectIds].join(',')})`)
    }
    taskQuery =
      axes.length === 1
        ? taskQuery.eq('assignee_id', member.id)
        : taskQuery.or(axes.join(','))
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
  const safeTaskIds =
    taskIds.length === 0 ? ['00000000-0000-0000-0000-000000000000'] : taskIds

  const [
    membersRes,
    projectsRes,
    allActiveProjectsRes,
    labelsRes,
    sprintsRes,
    sprintTasksRes,
    taskLabelsRes,
    checklistRes,
    depsOutRes,
    depsInRes,
    sprintTaskJoinForTasksRes,
    commentsRes,
    commentReactionsRes,
    taskReactionsRes,
    activityRes,
    teamActivityRes,
    meetingActivityRes,
    taskDeletionActivityRes,
    sprintActivityRes,
    externalRefsRes,
    projectExternalRefsRes,
    refTasksRes,
    projectAssigneesRes
  ] = await Promise.all([
    // members - always the full company team. Members previously got a
    // narrow slice (just the assignees / leads of their visible tasks),
    // which rendered "1 member" on every project card and made @-mention
    // pickers feel broken. The roster is small and read-only here, so we
    // hand it down whole and let the UI decide what to show.
    supabase
      .from('team_members')
      .select(
        'id, full_name, avatar_url, access_tier, slug, last_seen_at, activity_status, timezone, created_at'
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
      .select('sprint_id, task_id, carry_count')
      .in('task_id', safeTaskIds),
    // task_labels join rows for visible tasks, including the label name
    supabase
      .from('task_labels')
      .select(
        'task_id, label_id, labels!task_label_label_id_fkey(id, name, color)'
      )
      .in('task_id', safeTaskIds),
    // checklist items for visible tasks
    supabase
      .from('task_checklist_items')
      .select('*')
      .in('task_id', safeTaskIds)
      .order('sort_order', { ascending: true }),
    // task_dependencies in both directions. The two halves used to live in a
    // single `.or(task_id.in.(...),depends_on_task_id.in.(...))` but that
    // emits the full id list twice in the URL, blowing past the 16KB header
    // limit once the company has ~200 visible tasks. Two separate queries
    // ship the id list once each; we de-dupe the union in JS below.
    supabase
      .from('task_dependencies')
      .select('*')
      .eq('company_id', member.companyId)
      .in('task_id', safeTaskIds),
    supabase
      .from('task_dependencies')
      .select('*')
      .eq('company_id', member.companyId)
      .in('depends_on_task_id', safeTaskIds),
    // sprint_tasks again, this time scoped to give each task its sprint
    // links (used by mapTask for the sprint chip). Same data as
    // sprintTasksRes but with the sprint name fetched inline.
    supabase
      .from('sprint_tasks')
      .select(
        'task_id, carry_count, sprint:sprints!cycle_task_cycle_id_fkey(id, name)'
      )
      .in('task_id', safeTaskIds),
    // comments scoped to visible tasks
    supabase
      .from('task_comments')
      .select(
        '*, author:team_members!task_comment_author_id_fkey(id, full_name)'
      )
      .eq('company_id', member.companyId)
      .in('task_id', safeTaskIds)
      .order('created_at', { ascending: true }),
    // Comment reactions joined via the comments table so we can scope
    // by the visible task ids in a single round-trip. Returns one row per
    // (comment, member, emoji) tuple.
    supabase
      .from('comment_reactions')
      .select(
        'id, comment_id, member_id, emoji, created_at, task_comments!comment_reactions_comment_id_fkey!inner(task_id)'
      )
      .in('task_comments.task_id', safeTaskIds),
    // Task-level reactions, scoped to visible task ids directly.
    supabase
      .from('task_reactions')
      .select('id, task_id, member_id, emoji, created_at')
      .in('task_id', safeTaskIds),
    // activity log scoped to visible tasks (entity_id is generic, but
    // the (entity_type, entity_id) index makes the IN lookup efficient)
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .eq('entity_type', 'task')
      .in('entity_id', safeTaskIds)
      .order('created_at', { ascending: true }),
    // team-management activity (presence flips, tier changes, etc) plus
    // quick-room invites. Not scoped to a task so we just take everything
    // in the company and let the UI render them as informational rows.
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .in('entity_type', ['team_member', 'team_invite', 'room'])
      .order('created_at', { ascending: true }),
    // Meeting lifecycle events (requested/approved/scheduled/declined/
    // rejected/rescheduled/canceled). Same shape as team activity but
    // entity_type = 'meeting'.
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .eq('entity_type', 'meeting')
      .order('created_at', { ascending: true }),
    // Task deletions. Read separately from the visible-task activity query
    // because by definition the deleted task is NOT in safeTaskIds and would
    // never match the `entity_id IN (visibleTaskIds)` filter. Title/ref/etc
    // come from the metadata snapshot taken at delete time. We deliberately
    // only fetch `task.deleted` here, not `task.restored` - a restored task
    // is back in safeTaskIds, so its `task.restored` row arrives via the
    // regular `activityRes` query above. Fetching restores here too would
    // duplicate the row (same id in two branches -> React duplicate key).
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .eq('entity_type', 'task')
      .eq('action', 'task.deleted')
      .order('created_at', { ascending: false })
      .limit(100),
    // Sprint lifecycle events. entity_type='sprint', actions are
    // 'sprint.started' and 'sprint.ended'. We don't pre-filter by
    // project_id at SQL level because metadata.project_id is a JSON path;
    // filtering happens client-side when needed.
    supabase
      .from('activity_logs')
      .select('*, actor:team_members!activity_log_actor_id_fkey(id, full_name)')
      .eq('company_id', member.companyId)
      .eq('entity_type', 'sprint')
      .in('action', ['sprint.started', 'sprint.ended'])
      .order('created_at', { ascending: false })
      .limit(100),
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
      .is('deleted_at', null),
    // Per-project assignee roster. Covers every assignee on every
    // project in scope, ignoring the viewer's task-level filter, so the
    // Projects panel can render the real team on each card.
    (() => {
      let q = supabase
        .from('tasks')
        .select('project_id, assignee_id')
        .eq('company_id', member.companyId)
        .is('deleted_at', null)
        .not('assignee_id', 'is', null)
      if (myProjectIds !== null) {
        q = q.in('project_id', safeProjectIds(myProjectIds))
      }
      return q
    })()
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
    depsOutRes.error,
    depsInRes.error,
    sprintTaskJoinForTasksRes.error,
    commentsRes.error,
    commentReactionsRes.error,
    taskReactionsRes.error,
    activityRes.error,
    teamActivityRes.error,
    meetingActivityRes.error,
    taskDeletionActivityRes.error,
    sprintActivityRes.error,
    externalRefsRes.error,
    projectExternalRefsRes.error,
    refTasksRes.error,
    projectAssigneesRes.error
  ].filter((e): e is NonNullable<typeof e> => !!e)
  if (errors.length > 0) throw errors[0]

  // ---- Build lookups for stitching ----------------------------------------

  const taskRefById = new Map<string, TaskRefSummary>()
  for (const r of refTasksRes.data ?? []) {
    taskRefById.set(r.id, { id: r.id, ref: r.ref, title: r.title })
  }

  // Per-project assignee roster: distinct assignee ids per project_id,
  // built once and surfaced on the payload so the Projects panel can
  // render the real team on each card.
  const projectAssigneeIds: Record<string, string[]> = {}
  {
    const grouped = new Map<string, Set<string>>()
    for (const row of projectAssigneesRes.data ?? []) {
      if (!row.assignee_id) continue
      const set = grouped.get(row.project_id) ?? new Set<string>()
      set.add(row.assignee_id)
      grouped.set(row.project_id, set)
    }
    for (const [projectId, set] of grouped) {
      projectAssigneeIds[projectId] = [...set]
    }
  }

  // Sprint links per task id (for mapTask's sprint chip)
  const sprintLinksByTask = new Map<string, SprintLink[]>()
  for (const row of sprintTaskJoinForTasksRes.data ?? []) {
    // Supabase types the nested relation as either an object or an array;
    // single-FK joins always return an object at runtime.
    const sprint = (row.sprint as { id: string; name: string } | null) ?? null
    const list = sprintLinksByTask.get(row.task_id) ?? []
    list.push({ sprint, carryCount: row.carry_count ?? 0 })
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

  // dependencies: classify into out (task_id matches) and in (depends_on_task_id matches).
  // We fired two separate queries (depsOutRes scoped by task_id, depsInRes scoped by
  // depends_on_task_id) to keep each URL under the 16KB header cap; merge + dedupe by id.
  const depsOutByTask = new Map<string, DepsOutRow[]>()
  const depsInByTask = new Map<string, DepsInRow[]>()
  const depsSeen = new Set<string>()
  for (const dep of [...(depsOutRes.data ?? []), ...(depsInRes.data ?? [])]) {
    if (depsSeen.has(dep.id)) continue
    depsSeen.add(dep.id)
    if (taskIds.includes(dep.task_id)) {
      const list = depsOutByTask.get(dep.task_id) ?? []
      list.push({
        id: dep.id,
        kind: dep.kind,
        dependsOn: taskRefById.get(dep.depends_on_task_id) ?? null
      })
      depsOutByTask.set(dep.task_id, list)
    }
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
    assignee: t.assignee_id ? (memberById.get(t.assignee_id) ?? null) : null,
    lead: t.lead_id ? (memberById.get(t.lead_id) ?? null) : null,
    project: projectById.get(t.project_id) ?? null,
    labels: labelsByTask.get(t.id) ?? [],
    checklist: checklistByTask.get(t.id) ?? [],
    depsOut: depsOutByTask.get(t.id) ?? [],
    depsIn: depsInByTask.get(t.id) ?? [],
    sprintTasks: sprintLinksByTask.get(t.id) ?? []
  }))

  // ---- Sprints with their task ids ----------------------------------------

  const sprintTaskIdsBySprint = new Map<
    string,
    { taskId: string; carryCount: number }[]
  >()
  for (const link of sprintTasksRes.data ?? []) {
    const list = sprintTaskIdsBySprint.get(link.sprint_id) ?? []
    list.push({ taskId: link.task_id, carryCount: link.carry_count ?? 0 })
    sprintTaskIdsBySprint.set(link.sprint_id, list)
  }
  const sprints: DashboardSprintRow[] = (sprintsRes.data ?? []).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    number: s.number,
    name: s.name,
    goal: s.goal,
    description: s.description,
    docUrl: s.doc_url,
    status: s.status,
    fromDate: s.from_date,
    toDate: s.to_date,
    startedAt: s.started_at,
    closedAt: s.closed_at,
    shippedCount: s.shipped_count,
    carriedCount: s.carried_count,
    tasks: sprintTaskIdsBySprint.get(s.id) ?? []
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
    timezone: m.timezone,
    joinedAt: m.created_at
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

  const memberNameById = new Map<string, string>()
  for (const m of membersRes.data ?? []) {
    memberNameById.set(m.id, m.full_name)
  }
  const commentReactionsByComment: Record<string, DashboardReactionRow[]> = {}
  for (const r of commentReactionsRes.data ?? []) {
    const list = commentReactionsByComment[r.comment_id] ?? []
    list.push({
      id: r.id,
      emoji: r.emoji,
      memberId: r.member_id,
      memberName: memberNameById.get(r.member_id) ?? null,
      createdAt: r.created_at
    })
    commentReactionsByComment[r.comment_id] = list
  }
  const taskReactionsByTask: Record<string, DashboardReactionRow[]> = {}
  for (const r of taskReactionsRes.data ?? []) {
    const list = taskReactionsByTask[r.task_id] ?? []
    list.push({
      id: r.id,
      emoji: r.emoji,
      memberId: r.member_id,
      memberName: memberNameById.get(r.member_id) ?? null,
      createdAt: r.created_at
    })
    taskReactionsByTask[r.task_id] = list
  }

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

  const teamActivity: DashboardActivityRow[] = (teamActivityRes.data ?? []).map(
    (a) => {
      const actor = a.actor as { id: string; full_name: string } | null
      return {
        id: a.id,
        entityId: a.entity_id,
        action: a.action,
        createdAt: a.created_at,
        metadata: a.metadata,
        actor: actor ? { id: actor.id, fullName: actor.full_name } : null
      }
    }
  )

  const meetingActivity: DashboardActivityRow[] = (
    meetingActivityRes.data ?? []
  ).map((a) => {
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

  const taskDeletionActivity: DashboardActivityRow[] = (
    taskDeletionActivityRes.data ?? []
  ).map((a) => {
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

  // Scope sprint events to the viewer's visible projects so a member in
  // project A doesn't see project B's sprint announcements. metadata
  // carries project_id from logActivity in mutations.ts.
  const visibleProjectIds = myProjectIds === null ? null : new Set(myProjectIds)
  const sprintActivity: DashboardActivityRow[] = (sprintActivityRes.data ?? [])
    .filter((a) => {
      if (visibleProjectIds === null) return true
      const meta = a.metadata as Record<string, unknown> | null
      const pid =
        meta && typeof meta.project_id === 'string' ? meta.project_id : null
      return pid !== null && visibleProjectIds.has(pid)
    })
    .map((a) => {
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
    commentReactionsByComment,
    taskReactionsByTask,
    activity,
    teamActivity,
    meetingActivity,
    taskDeletionActivity,
    sprintActivity,
    externalRefs,
    projectExternalRefs,
    projectAssigneeIds,
    currentMember: {
      id: member.id,
      companyId: member.companyId,
      fullName: member.fullName,
      accessTier: member.accessTier,
      // Wizard bumps onboarding_step to 6 when the last step ("Your work")
      // saves or is skipped. Used by the dashboard to hide the sidebar
      // "Finish your profile" entry and move it into Settings.
      onboardingComplete: member.onboardingStep >= 6,
      isOwner: ownerId === member.id,
      // Surfaced so the client can enforce the same assignee/watcher scope
      // as the server when searching (e.g. command palette). Empty for
      // admins/leads since they see every task and don't need the union.
      watcherTaskIds,
      quickMeetUrl,
      timezone: member.timezone
    }
  }
}
