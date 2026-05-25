'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentCrewMember } from '@/lib/dal'
import { countMissingFields, isHandoffComplete } from '@/lib/handoff'
import type { TaskStatus, TaskPriority, RelationKind } from '@prisma/client'

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

  const where = {
    companyId: member.companyId,
    ...(projectId ? { projectId } : {})
  }

  const [tasks, members, projects, labels, cycles, comments, activity] =
    await Promise.all([
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
          cycleTasks: {
            include: { cycle: { select: { id: true, name: true } } }
          }
        },
        // Within-column ordering: explicit sortOrder first (3b drag/drop),
        // createdAt as fallback for rows that pre-date the migration.
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
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
        where: { companyId: member.companyId },
        select: { id: true, name: true, kind: true, isArchived: true },
        orderBy: [{ isArchived: 'asc' }, { name: 'asc' }]
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
      }),
      // Comments + activity for the drawer. Scoped to the same task set so
      // we don't pull rows for tasks the user can't see (e.g. when a
      // projectId filter is applied).
      prisma.taskComment.findMany({
        where: { companyId: member.companyId, task: where },
        include: {
          author: {
            select: { id: true, fullName: true, avatarInitials: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Activity log is filtered to the current company; we don't filter by
      // projectId here because activity_log.entity_id isn't a foreign key
      // (generic string). Final per-task grouping happens in mappers; rows
      // for tasks the user can't see are dropped there. Cheap for current
      // scale (single company, <100 tasks).
      prisma.activityLog.findMany({
        where: { companyId: member.companyId, entityType: 'task' },
        include: {
          actor: {
            select: { id: true, fullName: true, avatarInitials: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ])

  return {
    tasks,
    members,
    projects,
    labels,
    cycles,
    comments,
    activity,
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
