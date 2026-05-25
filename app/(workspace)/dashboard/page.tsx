import type { Metadata } from 'next'
import { fetchDashboardData } from './actions'
import DashboardShell from './_components/DashboardShell'
import {
  groupActivityByTask,
  groupCommentsByTask,
  mapCycles,
  mapMembers,
  mapTasks
} from './_components/mappers'

export const metadata: Metadata = {
  title: 'Task Handoff | Verbivore',
  description: 'Hand off, receive and track tasks across the Verbivore team.'
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: projectParam } = await searchParams
  const data = await fetchDashboardData(projectParam)

  const members = mapMembers(data.members)
  const tasks = mapTasks(data.tasks, members, data.members)
  const cycles = mapCycles(data.cycles, tasks)
  const commentsByTask = groupCommentsByTask(data.comments)
  const activityByTask = groupActivityByTask(data.activity)

  const projectExists = projectParam
    ? data.projects.some((p) => p.id === projectParam)
    : false
  const currentProjectId = projectExists ? projectParam! : null
  const activeProjects = data.projects.filter((p) => !p.isArchived)
  const defaultProjectId =
    activeProjects.find((p) => p.name === 'VerbivoreSeries')?.id ??
    activeProjects[0]?.id ??
    null

  return (
    <DashboardShell
      initial={{
        tasks,
        members,
        cycles,
        projects: data.projects.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          isArchived: p.isArchived
        })),
        labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
        commentsByTask,
        activityByTask,
        currentMember: {
          id: data.currentMember.id,
          fullName: data.currentMember.fullName,
          accessTier: data.currentMember.accessTier
        },
        currentProjectId,
        defaultProjectId
      }}
    />
  )
}
