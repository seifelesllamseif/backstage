import 'server-only'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import { fetchDashboardData } from '../actions'
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
  type TeamUpdate,
  type MeetingUpdate
} from './mappers'
import type { DashboardInitial } from './DashboardShell'

export async function fetchInitial(
  projectParam: string | undefined
): Promise<DashboardInitial> {
  const data = await fetchDashboardData(projectParam)

  const members = mapMembers(data.members)
  const tasks = mapTasks(data.tasks, members, data.members)
  const sprints = mapSprints(data.sprints, tasks)
  const commentsByTask = groupCommentsByTask(data.comments)
  const activityByTask = groupActivityByTask(data.activity)
  const externalRefsByTask = groupExternalRefsByTask(data.externalRefs)
  const externalRefsByProject = groupExternalRefsByProject(
    data.projectExternalRefs
  )
  const memberNamesById = new Map(
    data.members.map((m) => [m.id, m.fullName])
  )
  const teamUpdates: TeamUpdate[] = mapTeamActivity(
    data.teamActivity,
    memberNamesById,
    data.currentMember.id
  )
  const meetingUpdates: MeetingUpdate[] = mapMeetingActivity(
    data.meetingActivity
  )

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
  const defaultProjectId =
    activeProjects.find((p) => p.name === 'VerbivoreSeries')?.id ??
    activeProjects[0]?.id ??
    null

  return {
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

export async function resolveProjectTitle(
  projectParam: string | undefined
): Promise<string | null> {
  if (!projectParam) return null
  const member = await getCurrentTeamMember()
  if (!member) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectParam)
    .eq('company_id', member.companyId)
    .maybeSingle()
  return data?.name ?? null
}

const DASHBOARD_DESCRIPTION =
  'Hand off, receive and track tasks across the Verbivore team.'

export async function dashboardMetadata(
  projectParam: string | undefined
): Promise<{ title: string; description: string }> {
  if (!projectParam) {
    return {
      title: 'All Projects · Verbivore',
      description: DASHBOARD_DESCRIPTION
    }
  }
  const projectName = await resolveProjectTitle(projectParam)
  return {
    title: projectName ? `${projectName} · Verbivore` : 'BackStage · Verbivore',
    description: DASHBOARD_DESCRIPTION
  }
}
