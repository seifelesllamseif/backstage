import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentCrewMember } from '@/lib/dal'
import { fetchDashboardData } from './actions'
import DashboardShell from './_components/DashboardShell'
import {
  groupActivityByTask,
  groupCommentsByTask,
  groupExternalRefsByProject,
  groupExternalRefsByTask,
  mapCycles,
  mapMembers,
  mapTasks
} from './_components/mappers'

// Browser tab title follows the URL: "All tasks · Verbivore" when no
// project filter, "<Project name> · Verbivore" when one is pinned.
// Cost is one cheap lookup per navigation; Next.js' request-scoped
// cache dedupes if `prisma.project.findFirst` is hit again on the
// same render (it won't here — fetchDashboardData uses `findMany`).
export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ project?: string }>
}): Promise<Metadata> {
  const { project: projectParam } = await searchParams
  const description =
    'Hand off, receive and track tasks across the Verbivore team.'
  if (!projectParam) {
    return { title: 'All Projects · Verbivore', description }
  }
  const member = await getCurrentCrewMember()
  if (!member) {
    return { title: 'Task Handoff · Verbivore', description }
  }
  const project = await prisma.project.findFirst({
    where: { id: projectParam, companyId: member.companyId },
    select: { name: true }
  })
  return {
    title: project ? `${project.name} · Verbivore` : 'Task Handoff · Verbivore',
    description
  }
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
  const externalRefsByTask = groupExternalRefsByTask(data.externalRefs)
  const externalRefsByProject = groupExternalRefsByProject(
    data.projectExternalRefs
  )

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
          isArchived: p.isArchived,
          githubRepo: p.githubRepo
        })),
        allActiveProjects: data.allActiveProjects,
        labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
        commentsByTask,
        activityByTask,
        externalRefsByTask,
        externalRefsByProject,
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
