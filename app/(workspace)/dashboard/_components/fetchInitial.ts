import 'server-only'
import { fetchDashboardData } from '../actions'
import { listTaskAttachmentsForTasks } from '@/supabase/dashboard/taskAttachments'
import { runDueWarningsIfDue } from '@/supabase/dashboard/dueWarnings'
import {
  groupActivityByTask,
  groupCommentsByTask,
  groupExternalRefsByProject,
  groupExternalRefsByTask,
  mapSprints,
  mapMembers,
  mapTasks,
  mapTeamActivity,
  mapMeetingActivity,
  mapTaskDeletionActivity,
  mapSprintActivity,
  type TeamUpdate,
  type MeetingUpdate,
  type TaskDeletionUpdate,
  type SprintUpdate
} from './mappers'
import type { DashboardInitial } from './DashboardShell'

export async function fetchInitial(
  projectParam: string | undefined
): Promise<DashboardInitial> {
  const data = await fetchDashboardData(projectParam)

  // Fire-and-forget the due-soon fan-out. First load of the day wins the
  // race in Postgres; subsequent loads are no-ops. Failures never block
  // the dashboard render - the page proceeds regardless.
  void runDueWarningsIfDue(data.currentMember.companyId).catch((err) => {
    console.error('[due-warnings] failed', err)
  })

  const members = mapMembers(data.members)
  const tasks = mapTasks(data.tasks, members, data.members)
  const sprints = mapSprints(data.sprints, tasks)
  const commentsByTask = groupCommentsByTask(data.comments)
  const activityByTask = groupActivityByTask(data.activity)
  const externalRefsByTask = groupExternalRefsByTask(data.externalRefs)
  const externalRefsByProject = groupExternalRefsByProject(
    data.projectExternalRefs
  )
  const memberNamesById = new Map(data.members.map((m) => [m.id, m.fullName]))
  const teamUpdates: TeamUpdate[] = mapTeamActivity(
    data.teamActivity,
    memberNamesById,
    data.currentMember.id
  )
  const meetingUpdates: MeetingUpdate[] = mapMeetingActivity(
    data.meetingActivity
  )
  const taskDeletionUpdates: TaskDeletionUpdate[] = mapTaskDeletionActivity(
    data.taskDeletionActivity
  )
  const sprintUpdates: SprintUpdate[] = mapSprintActivity(data.sprintActivity)

  const taskIds = tasks.map((t) => t.id)
  const attachmentRows = await listTaskAttachmentsForTasks(taskIds)
  const attachmentsByTask: Record<string, typeof attachmentRows> = {}
  for (const row of attachmentRows) {
    const list = attachmentsByTask[row.taskId] ?? []
    list.push(row)
    attachmentsByTask[row.taskId] = list
  }

  const projectExists = projectParam
    ? data.projects.some((p) => p.id === projectParam)
    : false
  const activeProjects = data.projects.filter((p) => !p.isArchived)
  // Auto-pin: when the user only sees one active project (member assigned
  // to a single project, or any role with exactly one project visible),
  // default to that project instead of "All Projects". URL ?project=
  // still wins so it's overridable.
  const currentProjectId = projectExists
    ? projectParam!
    : activeProjects.length === 1
      ? activeProjects[0].id
      : null
  const defaultProjectId = activeProjects[0]?.id ?? null

  return {
    commentReactionsByComment: data.commentReactionsByComment,
    taskReactionsByTask: data.taskReactionsByTask,
    tasks,
    members,
    sprints,
    projects: data.projects.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      isArchived: p.isArchived,
      githubRepo: p.githubRepo
    })),
    allActiveProjects: data.allActiveProjects,
    labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
    commentsByTask,
    activityByTask,
    teamUpdates,
    meetingUpdates,
    taskDeletionUpdates,
    sprintUpdates,
    attachmentsByTask,
    externalRefsByTask,
    externalRefsByProject,
    projectAssigneeIds: data.projectAssigneeIds,
    currentMember: {
      id: data.currentMember.id,
      companyId: data.currentMember.companyId,
      fullName: data.currentMember.fullName,
      accessTier: data.currentMember.accessTier,
      onboardingComplete: data.currentMember.onboardingComplete,
      isOwner: data.currentMember.isOwner,
      watcherTaskIds: data.currentMember.watcherTaskIds,
      quickMeetUrl: data.currentMember.quickMeetUrl,
      timezone: data.currentMember.timezone
    },
    currentProjectId,
    defaultProjectId
  }
}
