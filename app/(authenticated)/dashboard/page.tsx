import type { Metadata } from 'next'
import { fetchDashboardData } from './actions'
import DashboardShell from './_components/DashboardShell'
import {
  mapCycles,
  mapMembers,
  mapTasks
} from './_components/mappers'

export const metadata: Metadata = {
  title: 'Task Handoff · Dashboard',
  description: 'Hand off, receive and track tasks across the SKAM team.'
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

  const projectExists = projectParam
    ? data.projects.some((p) => p.id === projectParam)
    : false
  const currentProjectId = projectExists ? projectParam! : null
  const defaultProjectId =
    data.projects.find((p) => p.name === 'SKAM Series')?.id ??
    data.projects[0]?.id ??
    null

  return (
    <DashboardShell
      initial={{
        tasks,
        members,
        cycles,
        projects: data.projects.map((p) => ({ id: p.id, name: p.name })),
        labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
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
