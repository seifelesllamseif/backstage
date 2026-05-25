'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Plus, RotateCcw, Sun, Moon } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  addComment as addCommentAction,
  createDashboardTask,
  deleteComment as deleteCommentAction,
  deleteDashboardTask,
  duplicateDashboardTask,
  editComment as editCommentAction,
  moveDashboardTask,
  updateDashboardTaskAssignee,
  updateDashboardTaskPriority,
  updateDashboardTaskStatus
} from '../actions'
import type { BoardAssignee, BoardTask, Cycle } from './boardData'
import {
  STATUSES,
  STATUS_BY_ID,
  TaskPriority,
  TaskStatus,
  PRIORITY_LABEL
} from './status'
import BoardColumn from './BoardColumn'
import TaskCard from './TaskCard'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import TaskDetail, { TaskActivity, TaskComment } from './TaskDetail'
import NewTaskModal from './NewTaskModal'
import Timeline from './Timeline'
import FilterPanel from './FilterPanel'
import { ProjectsPanel, SettingsPanel, UpdatesPanel } from './Panels'
import SymbolsPanel from './SymbolsPanel'
import ArchivePanel from './ArchivePanel'
import Avatar from './Avatar'
import { DashboardThemeProvider, useDashTheme } from './theme'
import { ContextMenuProvider, useContextMenu } from './ContextMenu'
import { TaskActionsProvider } from './actions'
import { TeamProvider } from './TeamContext'

export type GroupBy = 'status' | 'assignee' | 'priority'
export type View =
  | 'all'
  | 'mine'
  | 'inbox'
  | 'projects'
  | 'updates'
  | 'settings'
  | 'symbols'
  | 'archive'

export interface DashboardInitial {
  tasks: BoardTask[]
  members: BoardAssignee[]
  cycles: Cycle[]
  projects: {
    id: string
    name: string
    kind: 'standard' | 'operations'
    isArchived: boolean
  }[]
  labels: { id: string; name: string }[]
  commentsByTask: Record<string, TaskComment[]>
  activityByTask: Record<string, TaskActivity[]>
  currentMember: {
    id: string
    fullName: string
    accessTier: 'admin' | 'lead' | 'member'
  }
  currentProjectId: string | null
  defaultProjectId: string | null
}

function nowLabel() {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

export default function DashboardShellWrapper(props: {
  initial: DashboardInitial
}) {
  return (
    <DashboardThemeProvider>
      <ContextMenuProvider>
        <TeamProvider members={props.initial.members}>
          <DashboardShellInner {...props} />
        </TeamProvider>
      </ContextMenuProvider>
    </DashboardThemeProvider>
  )
}

function DashboardShellInner({ initial }: { initial: DashboardInitial }) {
  const { t, toggle, mode } = useDashTheme()
  const { open: openMenu } = useContextMenu()
  const router = useRouter()
  const mainScrollRef = useRef<HTMLElement | null>(null)
  const [, startTransition] = useTransition()

  const currentUserId = initial.currentMember.id
  const isAdmin = initial.currentMember.accessTier === 'admin'

  const team = initial.members
  // Ensure the signed-in user is always discoverable even if they have no
  // tasks in this slice (mapMembers returns everyone, but we fall back to a
  // synthesized record so role/avatar still render).
  const currentUser: BoardAssignee = team.find(
    (m) => m.id === currentUserId
  ) ?? {
    id: currentUserId,
    initials: initial.currentMember.fullName.slice(0, 2).toUpperCase(),
    name: initial.currentMember.fullName,
    color: 'bg-zinc-500/80',
    role: initial.currentMember.accessTier
  }

  const [tasks, setTasks] = useState<BoardTask[]>(initial.tasks)
  const [comments, setComments] = useState<Record<string, TaskComment[]>>(
    initial.commentsByTask
  )
  const [activity, setActivity] = useState<Record<string, TaskActivity[]>>(
    initial.activityByTask
  )

  const [view, setView] = useState<View>('all')
  const [tab, setTab] = useState<'board' | 'list' | 'timeline'>('board')
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [groupOpen, setGroupOpen] = useState(false)

  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(
    null
  )
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus>('todo')

  // Require 6px of movement before drag activates — single clicks on
  // cards keep opening the drawer (no accidental drags).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const [density, setDensity] = useState<'compact' | 'cozy'>('cozy')
  const [wipLimit, setWipLimit] = useState(0)
  const [notifyOnAssign, setNotifyOnAssign] = useState(true)

  const labelIdByName = useMemo(
    () => new Map(initial.labels.map((l) => [l.name, l.id])),
    [initial.labels]
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((task) => task.tags?.forEach((tag) => set.add(tag)))
    return [...set].sort()
  }, [tasks])

  const visibleTasks = useMemo(
    () =>
      isAdmin
        ? tasks
        : tasks.filter((task) => task.assignee?.id === currentUserId),
    [tasks, isAdmin, currentUserId]
  )

  const filtered = useMemo(() => {
    let list = visibleTasks

    if (view === 'mine')
      list = list.filter((task) => task.assignee?.id === currentUserId)
    if (view === 'inbox')
      list = list.filter(
        (task) => task.status === 'todo' || task.status === 'in_review'
      )

    if (statusFilter) list = list.filter((task) => task.status === statusFilter)
    if (priorityFilter)
      list = list.filter((task) => task.priority === priorityFilter)
    if (assigneeFilter)
      list = list.filter((task) => task.assignee?.id === assigneeFilter)
    if (tagFilter) list = list.filter((task) => task.tags?.includes(tagFilter))
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.ref.toLowerCase().includes(q) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }
    return list
  }, [
    visibleTasks,
    view,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    tagFilter,
    query,
    currentUserId
  ])

  const counts = {
    all: visibleTasks.length,
    mine: visibleTasks.filter((task) => task.assignee?.id === currentUserId)
      .length,
    inbox: visibleTasks.filter(
      (task) => task.status === 'todo' || task.status === 'in_review'
    ).length
  }

  const totals = {
    open: filtered.filter((task) => !['done', 'canceled'].includes(task.status))
      .length,
    due: filtered.filter((task) => task.priority === 'urgent').length,
    review: filtered.filter((task) => task.status === 'in_review').length,
    done: filtered.filter((task) => task.status === 'done').length
  }

  const logActivityLocal = (taskId: string, text: string) => {
    setActivity((cur) => {
      const list = cur[taskId] ?? []
      return {
        ...cur,
        [taskId]: [
          ...list,
          { id: nextId('act'), kind: 'status', text, at: nowLabel() }
        ]
      }
    })
  }

  const updateStatus = (id: string, s: TaskStatus) => {
    // Track the prior status so we can revert if the server rejects the
    // change — most commonly the slice-2 handoff gate blocking a move to
    // Done (decision 0015, 0022). Surfacing a proper toast for the
    // rejection lands in 3a step 5; until then, the card snapping back
    // to its prior column is the user-visible signal.
    const prev = tasks.find((t) => t.id === id)
    const prevStatus = prev?.status
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id
          ? { ...task, status: s, updatedAt: new Date().toISOString() }
          : task
      )
    )
    logActivityLocal(id, `Status set to ${STATUS_BY_ID[s].label}`)
    startTransition(async () => {
      const res = await updateDashboardTaskStatus(id, s)
      if (!res.ok) {
        console.error('updateStatus:', res.message)
        if (prevStatus !== undefined) {
          setTasks((cur) =>
            cur.map((task) =>
              task.id === id ? { ...task, status: prevStatus } : task
            )
          )
        }
        if (res.reason === 'handoff-incomplete' && res.taskUrl) {
          // Slice-2 gate (decision 0015, 0022). taskUrl points at the
          // handoff editor (slice-1 edit page).
          const url = res.taskUrl
          toast.error(res.message, {
            action: {
              label: 'Fill handoff',
              onClick: () => router.push(url)
            },
            duration: 8000
          })
        } else {
          toast.error(res.message)
        }
      }
    })
  }

  const updatePriority = (id: string, p: TaskPriority) => {
    setTasks((cur) =>
      cur.map((task) => (task.id === id ? { ...task, priority: p } : task))
    )
    logActivityLocal(id, `Priority set to ${PRIORITY_LABEL[p]}`)
    startTransition(async () => {
      const res = await updateDashboardTaskPriority(id, p)
      if ('error' in res) {
        console.error('updatePriority:', res.error)
        toast.error("Couldn't update priority.")
      }
    })
  }

  const updateAssignee = (id: string, assigneeId: string | null) => {
    const member = assigneeId
      ? team.find((m) => m.id === assigneeId)
      : undefined
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id ? { ...task, assignee: member ?? undefined } : task
      )
    )
    logActivityLocal(id, member ? `Assigned to ${member.name}` : 'Unassigned')
    startTransition(async () => {
      const res = await updateDashboardTaskAssignee(id, assigneeId)
      if ('error' in res) {
        console.error('updateAssignee:', res.error)
        toast.error("Couldn't update assignee.")
      }
    })
  }

  const addComment = (id: string, body: string, mentions?: string[]) => {
    setComments((cur) => {
      const list = cur[id] ?? []
      return {
        ...cur,
        [id]: [
          ...list,
          {
            id: nextId('cm'),
            author: currentUser.name,
            authorId: currentUserId,
            authorInitials: currentUser.initials,
            body,
            at: nowLabel(),
            mentions
          }
        ]
      }
    })
    setActivity((cur) => {
      const list = cur[id] ?? []
      return {
        ...cur,
        [id]: [
          ...list,
          {
            id: nextId('act'),
            kind: 'comment',
            text: 'You left a comment',
            at: nowLabel()
          }
        ]
      }
    })
    startTransition(async () => {
      const res = await addCommentAction(id, body, mentions)
      if ('error' in res) {
        console.error('addComment:', res.error)
        toast.error("Couldn't post comment.")
      }
    })
  }

  const editComment = (commentId: string, body: string) => {
    // Optimistic: update body + mark editedAt locally so the "(edited)"
    // tag flips immediately.
    const nowIso = new Date().toISOString()
    setComments((cur) => {
      const next: typeof cur = {}
      for (const [taskId, list] of Object.entries(cur)) {
        next[taskId] = list.map((c) =>
          c.id === commentId ? { ...c, body, editedAt: nowIso } : c
        )
      }
      return next
    })
    startTransition(async () => {
      const res = await editCommentAction(commentId, body)
      if ('error' in res) {
        console.error('editComment:', res.error)
        toast.error(res.error)
      }
    })
  }

  const deleteComment = (commentId: string) => {
    // Optimistic: remove from local state. On server failure, restore.
    let snapshot: typeof comments | null = null
    setComments((cur) => {
      snapshot = cur
      const next: typeof cur = {}
      for (const [taskId, list] of Object.entries(cur)) {
        next[taskId] = list.filter((c) => c.id !== commentId)
      }
      return next
    })
    startTransition(async () => {
      const res = await deleteCommentAction(commentId)
      if ('error' in res) {
        console.error('deleteComment:', res.error)
        if (snapshot) setComments(snapshot)
        toast.error(res.error)
      }
    })
  }

  const createTask = (
    draft: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'>
  ) => {
    const targetProjectId = initial.currentProjectId ?? initial.defaultProjectId
    if (!targetProjectId) {
      console.error('createTask: no project available; create a project first.')
      return
    }

    const tempId = nextId('t')
    const optimistic: BoardTask = {
      ...draft,
      id: tempId,
      ref: 'NEW…',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    }
    setTasks((cur) => [optimistic, ...cur])
    setActivity((cur) => ({
      ...cur,
      [tempId]: [
        {
          id: nextId('act'),
          kind: 'created',
          text: 'Task created',
          at: nowLabel()
        }
      ]
    }))
    setSelectedId(tempId)

    const labelIds = (draft.tags ?? [])
      .map((name) => labelIdByName.get(name))
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await createDashboardTask({
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        projectId: targetProjectId,
        assigneeId: draft.assignee?.id ?? null,
        dueDate: null,
        labelIds
      })
      if ('error' in res) {
        console.error('createTask:', res.error)
        setTasks((cur) => cur.filter((t) => t.id !== tempId))
        toast.error("Couldn't create task.")
        return
      }
      toast.success('Task created')
      const serverTask = res.task
      setTasks((cur) =>
        cur.map((t) =>
          t.id === tempId
            ? {
                ...t,
                id: serverTask.id,
                ref: serverTask.ref ?? t.ref,
                createdAt: serverTask.createdAt.toISOString().slice(0, 10),
                updatedAt: serverTask.updatedAt.toISOString()
              }
            : t
        )
      )
      setActivity((cur) => {
        const entry = cur[tempId]
        if (!entry) return cur
        const { [tempId]: _, ...rest } = cur
        return { ...rest, [serverTask.id]: entry }
      })
      setSelectedId((sid) => (sid === tempId ? serverTask.id : sid))
    })
  }

  // ─── Drag and drop ──────────────────────────────────────────────────
  // Column droppable IDs are `col:<status>`. onDragOver moves the card's
  // status in local state as the cursor crosses columns, so the dashed
  // drop-slot follows the cursor (instead of staying in the source
  // column). onDragCancel restores the pre-drag snapshot.

  const COL_PREFIX = 'col:'
  const SORT_STEP = 1024
  const dragSnapshotRef = useRef<BoardTask[] | null>(null)

  const byOrder = (a: BoardTask, b: BoardTask) =>
    (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.sortOrder ?? Number.MAX_SAFE_INTEGER)

  const onDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
    dragSnapshotRef.current = tasks
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setTasks((cur) => {
      const activeTask = cur.find((t) => t.id === activeId)
      if (!activeTask) return cur

      let targetStatus: TaskStatus
      if (overId.startsWith(COL_PREFIX)) {
        targetStatus = overId.slice(COL_PREFIX.length) as TaskStatus
      } else {
        const overTask = cur.find((t) => t.id === overId)
        if (!overTask) return cur
        targetStatus = overTask.status
      }

      if (activeTask.status === targetStatus) return cur

      return cur.map((t) =>
        t.id === activeId ? { ...t, status: targetStatus } : t
      )
    })
  }

  const onDragCancel = () => {
    if (dragSnapshotRef.current) setTasks(dragSnapshotRef.current)
    dragSnapshotRef.current = null
    setActiveDragId(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null

    const activeId = String(event.active.id)
    const overId = event.over?.id != null ? String(event.over.id) : null

    // Drop missed any target — revert to pre-drag state.
    if (!overId) {
      if (snapshot) setTasks(snapshot)
      return
    }

    // Use the post-onDragOver state for the target column.
    const moved = tasks.find((t) => t.id === activeId)
    if (!moved) return
    const toStatus = moved.status

    // Compute insertion index within the destination column.
    const colSiblings = tasks
      .filter((t) => t.status === toStatus && t.id !== activeId)
      .sort(byOrder)
    let toIndex: number
    if (overId.startsWith(COL_PREFIX)) {
      toIndex = colSiblings.length
    } else {
      const idx = colSiblings.findIndex((t) => t.id === overId)
      toIndex = idx < 0 ? colSiblings.length : idx
    }

    // Renumber the destination column locally so the optimistic order
    // matches what the server will persist.
    setTasks((cur) => {
      const colTaskIds = cur
        .filter((t) => t.status === toStatus && t.id !== activeId)
        .sort(byOrder)
        .map((t) => t.id)
      const clamped = Math.max(0, Math.min(toIndex, colTaskIds.length))
      const reordered = [
        ...colTaskIds.slice(0, clamped),
        activeId,
        ...colTaskIds.slice(clamped)
      ]
      const sortMap = new Map(reordered.map((id, i) => [id, i * SORT_STEP]))
      return cur.map((t) =>
        sortMap.has(t.id) ? { ...t, sortOrder: sortMap.get(t.id)! } : t
      )
    })

    startTransition(async () => {
      const res = await moveDashboardTask(activeId, toStatus, toIndex)
      if (!res.ok) {
        console.error('moveDashboardTask:', res.message)
        if (snapshot) setTasks(snapshot)
        if (res.reason === 'handoff-incomplete' && res.taskUrl) {
          const url = res.taskUrl
          toast.error(res.message, {
            action: {
              label: 'Fill handoff',
              onClick: () => router.push(url)
            },
            duration: 8000
          })
        } else {
          toast.error(res.message)
        }
      }
    })
  }

  const openNewTask = (status?: TaskStatus) => {
    setNewTaskColumn(status ?? 'todo')
    setNewTaskOpen(true)
  }

  const deleteTask = (id: string) => {
    const snapshot = tasks
    const removed = snapshot.find((t) => t.id === id)
    setTasks((cur) => cur.filter((task) => task.id !== id))
    if (selectedId === id) setSelectedId(null)
    startTransition(async () => {
      const res = await deleteDashboardTask(id)
      if ('error' in res) {
        console.error('deleteTask:', res.error)
        setTasks(snapshot)
        toast.error("Couldn't delete task.")
        return
      }
      toast(`Deleted "${removed?.title ?? 'task'}"`, {
        action: {
          label: 'Undo',
          // Undo by recreating the row server-side. Optimistic: put the card
          // back immediately so the user sees it return even if the server
          // round-trip is slow.
          onClick: () => {
            if (!removed) return
            setTasks((cur) => [removed, ...cur])
            startTransition(async () => {
              await createDashboardTask({
                title: removed.title,
                status: removed.status,
                priority: removed.priority,
                projectId:
                  initial.currentProjectId ?? initial.defaultProjectId ?? '',
                assigneeId: removed.assignee?.id ?? null,
                dueDate: null,
                labelIds: []
              })
            })
          }
        }
      })
    })
  }

  const duplicateTask = (id: string) => {
    const src = tasks.find((task) => task.id === id)
    if (!src) return
    const tempId = nextId('t')
    const optimistic: BoardTask = {
      ...src,
      id: tempId,
      ref: 'NEW…',
      title: `${src.title} (copy)`,
      status: 'duplicate',
      relations: [{ kind: 'parent', ref: src.ref }],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    }
    setTasks((cur) => [optimistic, ...cur])
    startTransition(async () => {
      const res = await duplicateDashboardTask(id)
      if ('error' in res) {
        console.error('duplicateTask:', res.error)
        setTasks((cur) => cur.filter((t) => t.id !== tempId))
        return
      }
      const serverTask = res.task
      setTasks((cur) =>
        cur.map((t) =>
          t.id === tempId
            ? {
                ...t,
                id: serverTask.id,
                ref: serverTask.ref ?? t.ref,
                createdAt: serverTask.createdAt.toISOString().slice(0, 10),
                updatedAt: serverTask.updatedAt.toISOString()
              }
            : t
        )
      )
    })
  }

  const copyRef = (taskRef: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(taskRef).catch(() => {})
    }
  }

  const resetFilters = () => {
    setStatusFilter(null)
    setPriorityFilter(null)
    setAssigneeFilter(null)
    setTagFilter(null)
    setQuery('')
  }

  const refreshFromServer = () => {
    router.refresh()
    setComments({})
    setActivity({})
    setSelectedId(null)
  }

  const selected = selectedId
    ? (tasks.find((task) => task.id === selectedId) ?? null)
    : null

  const globalActivity = useMemo(() => {
    const all = Object.entries(activity).flatMap(([taskId, list]) => {
      const task = tasks.find((task) => task.id === taskId)
      return list.map((a) => ({
        id: a.id,
        text: task ? `[${task.ref}] ${a.text}` : a.text,
        at: a.at
      }))
    })
    return all.reverse()
  }, [activity, tasks])

  // Sort within each column: explicit sortOrder first (3b drag/drop),
  // createdAt as the fallback for rows that pre-date the migration.
  const byColumnOrder = (a: BoardTask, b: BoardTask) => {
    const aRank = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const bRank = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return b.createdAt.localeCompare(a.createdAt)
  }

  const groups: { key: string; label: string; items: BoardTask[] }[] =
    groupBy === 'status'
      ? STATUSES.map((s) => ({
          key: s.id,
          label: s.label,
          items: filtered
            .filter((task) => task.status === s.id)
            .sort(byColumnOrder)
        }))
      : groupBy === 'priority'
        ? (['urgent', 'high', 'medium', 'low', 'none'] as TaskPriority[]).map(
            (p) => ({
              key: p,
              label: PRIORITY_LABEL[p],
              items: filtered
                .filter((task) => task.priority === p)
                .sort(byColumnOrder)
            })
          )
        : [
            ...team.map((m) => ({
              key: m.id,
              label: m.name,
              items: filtered
                .filter((task) => task.assignee?.id === m.id)
                .sort(byColumnOrder)
            })),
            {
              key: 'unassigned',
              label: 'Unassigned',
              items: filtered
                .filter((task) => !task.assignee)
                .sort(byColumnOrder)
            }
          ]

  const actions = {
    changeStatus: updateStatus,
    changePriority: updatePriority,
    changeAssignee: updateAssignee,
    duplicate: duplicateTask,
    remove: deleteTask,
    copyRef,
    openDetail: setSelectedId,
    addInColumn: openNewTask,
    setStatusFilter,
    setAssigneeFilter
  }

  const onProjectChange = (projectId: string | null) => {
    const params = new URLSearchParams()
    if (projectId) params.set('project', projectId)
    const qs = params.toString()
    router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  const activeQuickFilter: 'open' | 'due' | 'review' | 'done' | null =
    priorityFilter === 'urgent' && !statusFilter
      ? 'due'
      : statusFilter === 'in_review' && !priorityFilter
        ? 'review'
        : statusFilter === 'done' && !priorityFilter
          ? 'done'
          : !statusFilter &&
              !priorityFilter &&
              !assigneeFilter &&
              !tagFilter &&
              !query.trim()
            ? 'open'
            : null

  const onQuickFilter = (kind: 'open' | 'due' | 'review' | 'done') => {
    if (kind === 'open') {
      resetFilters()
      return
    }
    if (kind === 'due') {
      setStatusFilter(null)
      setPriorityFilter(priorityFilter === 'urgent' ? null : 'urgent')
      return
    }
    if (kind === 'review') {
      setPriorityFilter(null)
      setStatusFilter(statusFilter === 'in_review' ? null : 'in_review')
      return
    }
    setPriorityFilter(null)
    setStatusFilter(statusFilter === 'done' ? null : 'done')
  }

  return (
    <TaskActionsProvider value={actions}>
      <div
        className={`fixed inset-0 flex flex-col overflow-hidden font-[var(--font-favorit)] ${t.page}`}
      >
        <div
          onWheel={(e) => {
            if (view !== 'archive') return
            const scroller = document.querySelector<HTMLElement>(
              '[data-archive-scroll]'
            )
            if (scroller) scroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
          }}
          className={`flex h-11 shrink-0 items-center justify-between border-b px-4 text-xs ${t.topbar}`}
        >
          <Link
            href="/portfolio"
            className={`flex items-center gap-1.5 transition ${t.backLink}`}
          >
            <ArrowLeft className="size-3" />
            Back to overview
          </Link>
          <span
            className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
          >
            Verbivore · Task Handoff
          </span>
          <CurrentUserBadge user={currentUser} isAdmin={isAdmin} />
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 w-56 shrink-0">
            <Sidebar
              activeView={
                view === 'projects' ||
                view === 'updates' ||
                view === 'settings' ||
                view === 'symbols' ||
                view === 'archive'
                  ? 'all'
                  : view
              }
              onView={(v) => setView(v)}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              assigneeFilter={assigneeFilter}
              onAssigneeFilter={setAssigneeFilter}
              counts={counts}
              secondary={view}
              onSecondary={(v) => setView(v)}
            />
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <Topbar
              query={query}
              onQuery={setQuery}
              tab={tab}
              onTab={setTab}
              totals={totals}
              onNewTask={() => openNewTask()}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              filterOpen={filterOpen}
              groupBy={groupBy}
              onGroupBy={(g) => {
                setGroupBy(g)
                setGroupOpen(false)
              }}
              groupOpen={groupOpen}
              onToggleGroup={() => setGroupOpen((v) => !v)}
              projects={initial.projects.filter((p) => !p.isArchived)}
              currentProjectId={initial.currentProjectId}
              onProjectChange={onProjectChange}
              activeQuickFilter={activeQuickFilter}
              onQuickFilter={onQuickFilter}
            />

            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityFilter={setPriorityFilter}
              assigneeFilter={assigneeFilter}
              onAssigneeFilter={setAssigneeFilter}
              tagFilter={tagFilter}
              onTagFilter={setTagFilter}
              allTags={allTags}
              onReset={resetFilters}
            />

            <main
              ref={(el) => {
                mainScrollRef.current = el
              }}
              onWheel={(e) => {
                if (view !== 'archive') return
                const scroller =
                  mainScrollRef.current?.querySelector<HTMLElement>(
                    '[data-archive-scroll]'
                  )
                if (!scroller || scroller.contains(e.target as Node)) return
                scroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
              }}
              className={`min-h-0 flex-1 overflow-hidden ${view === 'archive' ? 'p-0' : 'p-3'}`}
              onContextMenu={(e) => {
                const targetIsCard = (e.target as HTMLElement).closest(
                  'button[data-card]'
                )
                if (targetIsCard) return
                openMenu(e, [
                  {
                    id: 'add',
                    label: 'New task',
                    icon: <Plus className="size-3.5" />,
                    shortcut: 'N',
                    onSelect: () => openNewTask()
                  },
                  { id: 'sep', label: '', separator: true },
                  {
                    id: 'switch-board',
                    label: 'Board view',
                    disabled: tab === 'board',
                    onSelect: () => setTab('board')
                  },
                  {
                    id: 'switch-list',
                    label: 'List view',
                    disabled: tab === 'list',
                    onSelect: () => setTab('list')
                  },
                  {
                    id: 'switch-timeline',
                    label: 'Timeline view',
                    disabled: tab === 'timeline',
                    onSelect: () => setTab('timeline')
                  },
                  { id: 'sep2', label: '', separator: true },
                  {
                    id: 'toggle-theme',
                    label:
                      mode === 'light' ? 'Switch to dark' : 'Switch to light',
                    icon:
                      mode === 'light' ? (
                        <Moon className="size-3.5" />
                      ) : (
                        <Sun className="size-3.5" />
                      ),
                    onSelect: toggle
                  },
                  {
                    id: 'reset-filters',
                    label: 'Reset filters',
                    icon: <RotateCcw className="size-3.5" />,
                    onSelect: resetFilters
                  }
                ])
              }}
            >
              {(view === 'all' || view === 'mine' || view === 'inbox') && (
                <>
                  {tab === 'board' && (
                    <DndContext
                      id="dashboard-board"
                      sensors={sensors}
                      collisionDetection={closestCorners}
                      onDragStart={onDragStart}
                      onDragOver={onDragOver}
                      onDragEnd={onDragEnd}
                      onDragCancel={onDragCancel}
                    >
                      {/* Scrollbars hidden (chrome + firefox + ie) but scroll
                          still works via wheel/trackpad. No gradient hint. */}
                      <div className="flex h-full min-h-0 [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {groups.map((g) => {
                          const status =
                            groupBy === 'status'
                              ? (STATUS_BY_ID[g.key as TaskStatus] ??
                                STATUSES[0])
                              : undefined
                          return (
                            <BoardColumn
                              key={g.key}
                              title={g.label}
                              statusId={status?.id}
                              tasks={g.items}
                              selectedTaskId={selectedId}
                              onSelect={setSelectedId}
                              onAdd={
                                groupBy === 'status'
                                  ? () => openNewTask(g.key as TaskStatus)
                                  : undefined
                              }
                              density={density}
                              wipLimit={wipLimit}
                              droppableId={`col:${status?.id ?? g.key}`}
                            />
                          )
                        })}
                      </div>
                      <DragOverlay dropAnimation={null}>
                        {activeDragId
                          ? (() => {
                              const t = tasks.find((x) => x.id === activeDragId)
                              return t ? (
                                <div className="rotate-1 opacity-95 shadow-2xl">
                                  <TaskCard task={t} draggable={false} />
                                </div>
                              ) : null
                            })()
                          : null}
                      </DragOverlay>
                    </DndContext>
                  )}
                  {tab === 'list' && (
                    <ListView tasks={filtered} onSelect={setSelectedId} />
                  )}
                  {tab === 'timeline' && (
                    <Timeline tasks={filtered} onSelect={setSelectedId} />
                  )}
                </>
              )}

              {view === 'projects' && (
                <ProjectsPanel
                  tasks={visibleTasks}
                  projects={initial.projects}
                  currentUserId={currentUserId}
                  accessTier={initial.currentMember.accessTier}
                />
              )}
              {view === 'updates' && <UpdatesPanel activity={globalActivity} />}
              {view === 'symbols' && <SymbolsPanel />}
              {view === 'archive' && (
                <ArchivePanel
                  cycles={initial.cycles}
                  tasks={visibleTasks}
                  comments={comments}
                  activity={activity}
                  onChangeStatus={updateStatus}
                  onChangePriority={updatePriority}
                  onChangeAssignee={updateAssignee}
                  onAddComment={addComment}
                />
              )}
              {view === 'settings' && (
                <SettingsPanel
                  density={density}
                  setDensity={setDensity}
                  wipLimit={wipLimit}
                  setWipLimit={setWipLimit}
                  notifyOnAssign={notifyOnAssign}
                  setNotifyOnAssign={setNotifyOnAssign}
                  onClearTasks={refreshFromServer}
                />
              )}
            </main>

            <Sheet
              open={!!selected}
              onOpenChange={(open) => {
                if (!open) setSelectedId(null)
              }}
            >
              <SheetContent
                side="right"
                className={`w-full p-0 sm:!max-w-[440px] ${t.detail}`}
              >
                <VisuallyHidden.Root>
                  <SheetTitle>
                    {selected ? selected.title : 'Task detail'}
                  </SheetTitle>
                </VisuallyHidden.Root>
                {selected && (
                  <TaskDetail
                    task={selected}
                    comments={comments[selected.id] ?? []}
                    activity={activity[selected.id] ?? []}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedId(null)}
                    onChangeStatus={updateStatus}
                    onChangePriority={updatePriority}
                    onChangeAssignee={updateAssignee}
                    onAddComment={addComment}
                    onEditComment={editComment}
                    onDeleteComment={deleteComment}
                  />
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <NewTaskModal
          open={newTaskOpen}
          defaultStatus={newTaskColumn}
          members={team}
          onClose={() => setNewTaskOpen(false)}
          onCreate={createTask}
        />
      </div>
    </TaskActionsProvider>
  )
}

function CurrentUserBadge({
  user,
  isAdmin
}: {
  user: BoardAssignee
  isAdmin: boolean
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-2 py-1 ${t.btn}`}
    >
      <Avatar user={user} size={22} />
      <span className={`text-xs ${t.text} hidden sm:inline`}>{user.name}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${
          isAdmin
            ? 'bg-red-500/15 text-red-500'
            : `${t.surfaceMuted} ${t.textMuted}`
        }`}
      >
        {isAdmin ? 'Admin' : 'Member'}
      </span>
    </div>
  )
}

function ListView({
  tasks,
  onSelect
}: {
  tasks: BoardTask[]
  onSelect: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border ${t.column}`}
    >
      <div
        className={`grid grid-cols-[80px_1fr_120px_140px_60px_80px] gap-3 border-b px-3 py-2 text-[10px] tracking-wider uppercase ${t.textSubtle} ${t.columnHeader}`}
      >
        <span>Ref</span>
        <span>Title</span>
        <span>Status</span>
        <span>Assignee</span>
        <span>Prio</span>
        <span>Due</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`grid w-full grid-cols-[80px_1fr_120px_140px_60px_80px] items-center gap-3 border-b px-3 py-2.5 text-left text-xs transition ${t.dividerSoft} ${t.rowHover}`}
          >
            <span
              className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
            >
              {task.ref}
            </span>
            <span className={`truncate ${t.text}`}>{task.title}</span>
            <span className={t.textMuted}>{task.status.replace('_', ' ')}</span>
            <span
              className={`flex items-center gap-1.5 truncate ${t.textMuted}`}
            >
              {task.assignee ? (
                <>
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white ${task.assignee.color}`}
                  >
                    {task.assignee.initials}
                  </span>
                  <span className="truncate">{task.assignee.name}</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className={`capitalize ${t.textMuted}`}>{task.priority}</span>
            <span className={t.textSubtle}>{task.due ?? '—'}</span>
          </button>
        ))}
        {tasks.length === 0 && (
          <p className={`px-3 py-6 text-center text-xs italic ${t.textSubtle}`}>
            No tasks match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
