'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentCrewMember } from '@/lib/dal'
import type { TaskStatus, TaskPriority, RelationKind } from '@prisma/client'

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

  const where = {
    companyId: member.companyId,
    ...(projectId ? { projectId } : {})
  }

  const [tasks, members, projects, labels, cycles] = await Promise.all([
    prisma.task.findMany({
      where,
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
        cycleTasks: { include: { cycle: { select: { id: true, name: true } } } }
      },
      orderBy: [{ createdAt: 'desc' }]
    }),
    prisma.crewMember.findMany({
      where: { companyId: member.companyId },
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
      where: { companyId: member.companyId, isArchived: false },
      select: { id: true, name: true, kind: true },
      orderBy: { name: 'asc' }
    }),
    prisma.label.findMany({
      where: { companyId: member.companyId },
      orderBy: { name: 'asc' }
    }),
    prisma.cycle.findMany({
      where: {
        companyId: member.companyId,
        ...(projectId ? { projectId } : {})
      },
      include: { tasks: { select: { taskId: true } } },
      orderBy: [{ status: 'asc' }, { number: 'desc' }]
    })
  ])

  return {
    tasks,
    members,
    projects,
    labels,
    cycles,
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

export async function updateDashboardTaskStatus(
  taskId: string,
  status: TaskStatus
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { status }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.status_changed',
    'task',
    taskId,
    { status }
  )
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskPriority(
  taskId: string,
  priority: TaskPriority
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { priority }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.priority_changed',
    'task',
    taskId,
    { priority }
  )
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDashboardTaskAssignee(
  taskId: string,
  assigneeId: string | null
) {
  const member = await getCurrentCrewMember()
  if (!member) return { error: 'Not signed in.' }

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId }
  })

  await logActivity(
    member.companyId,
    member.id,
    'task.assignee_changed',
    'task',
    taskId,
    { assigneeId }
  )
  revalidatePath('/dashboard')
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
      status: 'duplicate',
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
