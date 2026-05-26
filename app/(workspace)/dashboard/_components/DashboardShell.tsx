'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  Plus,
  RotateCcw,
  Sun,
  Moon,
  X,
  PlusCircle
} from 'lucide-react'
import { signOut } from '@/app/login/actions'
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
  addProjectExternalRef as addProjectExternalRefAction,
  addTaskExternalRef as addTaskExternalRefAction,
  createBulkDashboardTasks,
  createDashboardTask,
  deleteComment as deleteCommentAction,
  deleteDashboardTask,
  duplicateDashboardTask,
  editComment as editCommentAction,
  moveDashboardTask,
  removeProjectExternalRef as removeProjectExternalRefAction,
  removeTaskExternalRef as removeTaskExternalRefAction,
  updateDashboardTaskAssignee,
  updateDashboardTaskLead,
  updateDashboardTaskPriority,
  updateDashboardTaskStatus,
  addTaskDependency,
  removeTaskDependency
} from '../actions'
import { parseExternalRef as parseExternalRefClient } from '@/lib/externalRef'
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
import type { ProjectExternalRef, TaskExternalRef } from './boardData'
import NewTaskModal from './NewTaskModal'
import Timeline from './Timeline'
import FilterPanel from './FilterPanel'
import { ProjectsPanel, SettingsPanel, UpdatesPanel } from './Panels'
import CyclesPanel from './CyclesPanel'
import CycleHero from './CycleHero'
import HandoffSheet from './HandoffSheet'
import { CopyButton, type CopyMenuItem } from '@/components/ui/copy-button'
import { viewToJson, viewToMarkdown } from '@/lib/export/view'
import { cycleToJson, cycleToMarkdown } from '@/lib/export/cycle'
import { taskToJson, taskToMarkdown } from '@/lib/export/task'
import { projectToJson, projectToMarkdown } from '@/lib/export/project'
import { isInScope, type TimeScope } from '@/lib/export/timeRange'
import type { ExportContext } from '@/lib/export/types'
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
  | 'mentions'
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
    githubRepo: string | null
  }[]
  // Full active-project list for the bulk-add picker. Not member-scoped:
  // members may not have any tasks yet but still need to pick a target
  // project to create *into*. Reads remain scoped via `projects`.
  allActiveProjects: { id: string; name: string }[]
  labels: { id: string; name: string }[]
  commentsByTask: Record<string, TaskComment[]>
  activityByTask: Record<string, TaskActivity[]>
  externalRefsByTask: Record<string, TaskExternalRef[]>
  externalRefsByProject: Record<string, ProjectExternalRef[]>
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

// ─── Copy-view helpers ────────────────────────────────────────────────────
// Derive a stable title + scope label from the current view + project so
// the markdown header reads naturally. The default group-by mirrors what
// the user sees on screen (status / priority / assignee) so the paste
// matches the visual structure.

function viewTitle(
  view: View,
  currentProjectId: string | null,
  projects: { id: string; name: string }[]
): string {
  const project = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null
  const base = (() => {
    if (view === 'mine') return 'My tasks'
    if (view === 'inbox') return 'Inbox'
    if (view === 'mentions') return 'Mentions'
    if (view === 'projects') return 'Projects'
    if (view === 'updates') return 'Updates'
    if (view === 'symbols') return 'Symbol library'
    if (view === 'settings') return 'Workspace settings'
    if (view === 'archive') return 'Archive'
    return 'All tasks'
  })()
  return project ? `${project.name} — ${base}` : base
}

function buildViewMarkdown(args: {
  tasks: BoardTask[]
  ctx: ExportContext
  view: View
  groupBy: GroupBy
  currentProjectId: string | null
  projects: { id: string; name: string }[]
}): string {
  return viewToMarkdown(args.tasks, args.ctx, {
    title: viewTitle(args.view, args.currentProjectId, args.projects),
    groupBy: args.groupBy
  })
}

function scopedTasks(
  tasks: BoardTask[],
  scope: Exclude<TimeScope, 'all' | 'cycle'>
): BoardTask[] {
  const now = new Date()
  // "Today / This week / This month" buckets are based on updatedAt so the
  // export captures recent movement (drops, status changes, comments) not
  // just newly-created tasks.
  return tasks.filter((task) => isInScope(task.updatedAt, scope, now))
}

function buildViewCopyMenu(args: {
  filtered: BoardTask[]
  allTasks: BoardTask[]
  ctx: ExportContext
  view: View
  groupBy: GroupBy
  currentProjectId: string | null
  projects: { id: string; name: string }[]
  cycles: Cycle[]
}): CopyMenuItem[] {
  const baseTitle = viewTitle(args.view, args.currentProjectId, args.projects)
  const meta = (extra?: string) => ({
    title: extra ? `${baseTitle} (${extra})` : baseTitle,
    groupBy: args.groupBy,
    scopeLabel: extra
  })
  const items: CopyMenuItem[] = [
    {
      id: 'md-full',
      label: 'Copy as Markdown',
      description: 'Filtered tasks, comments + activity',
      getContent: () => viewToMarkdown(args.filtered, args.ctx, meta()),
      toastLabel: 'page as Markdown'
    },
    {
      id: 'md-slim',
      label: 'Copy as Markdown (no comments)',
      description: 'Filtered tasks, metadata only',
      getContent: () =>
        viewToMarkdown(args.filtered, args.ctx, meta(), {
          withoutCommentsAndActivity: true
        }),
      toastLabel: 'page as Markdown'
    },
    {
      id: 'json-full',
      label: 'Copy as JSON',
      description: 'Versioned shape for agent ingestion',
      getContent: () => viewToJson(args.filtered, args.ctx, meta()),
      toastLabel: 'page as JSON'
    },
    {
      id: 'json-slim',
      label: 'Copy as JSON (no comments)',
      description: 'Slim shape, metadata only',
      getContent: () =>
        viewToJson(args.filtered, args.ctx, meta(), {
          withoutCommentsAndActivity: true
        }),
      toastLabel: 'page as JSON'
    }
  ]
  // Time-scope shortcuts always operate on the *unfiltered* visible task set
  // so the user can grab "everything updated this week" without losing
  // tasks the on-screen filters have hidden.
  items.push(
    {
      id: 'today',
      label: 'Copy today (Markdown)',
      description: 'Tasks updated since midnight',
      separatorBefore: true,
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'today'),
          args.ctx,
          meta('today')
        ),
      toastLabel: "today's tasks"
    },
    {
      id: 'week',
      label: 'Copy this week (Markdown)',
      description: 'Tasks updated since Monday',
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'week'),
          args.ctx,
          meta('this week')
        ),
      toastLabel: "this week's tasks"
    },
    {
      id: 'month',
      label: 'Copy this month (Markdown)',
      description: 'Tasks updated this calendar month',
      getContent: () =>
        viewToMarkdown(
          scopedTasks(args.allTasks, 'month'),
          args.ctx,
          meta('this month')
        ),
      toastLabel: "this month's tasks"
    }
  )

  const projectScopedCycles = args.currentProjectId
    ? args.cycles.filter((c) => c.projectId === args.currentProjectId)
    : args.cycles
  if (projectScopedCycles.length > 0) {
    items.push({
      id: 'by-cycle',
      label: 'Copy by sprint',
      description: 'Pick a sprint to export',
      separatorBefore: true,
      submenu: projectScopedCycles.map((c) => ({
        id: `cycle-${c.id}`,
        label: `${c.name} (${c.status})`,
        getContent: () => cycleToMarkdown(c, args.ctx),
        toastLabel: `sprint ${c.name}`
      }))
    })
  }
  return items
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
  const [isPending, startTransition] = useTransition()

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
  const [cycles, setCycles] = useState<Cycle[]>(initial.cycles)
  const [externalRefs, setExternalRefs] = useState<
    Record<string, TaskExternalRef[]>
  >(initial.externalRefsByTask)
  const [projectExternalRefs, setProjectExternalRefs] = useState<
    Record<string, ProjectExternalRef[]>
  >(initial.externalRefsByProject)

  // Resync local state when the server hands us fresh data via router.refresh
  // (bulk create, "reset board", project switch). Per-mutation flows update
  // local state optimistically and don't refresh, so this only fires at the
  // moments where the server is the source of truth.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks(initial.tasks)
  }, [initial.tasks])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments(initial.commentsByTask)
  }, [initial.commentsByTask])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivity(initial.activityByTask)
  }, [initial.activityByTask])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCycles(initial.cycles)
  }, [initial.cycles])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExternalRefs(initial.externalRefsByTask)
  }, [initial.externalRefsByTask])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectExternalRefs(initial.externalRefsByProject)
  }, [initial.externalRefsByProject])

  const [view, setView] = useState<View>('all')
  const [tab, setTab] = useState<'board' | 'list' | 'timeline' | 'cycles'>(
    'board'
  )
  // The Cycles tab is project-scoped. If the user navigates back to "All
  // projects" while on it, drop them on Board so they don't see a blank
  // panel.
  useEffect(() => {
    if (tab === 'cycles' && !initial.currentProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab('board')
    }
  }, [tab, initial.currentProjectId])
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [groupOpen, setGroupOpen] = useState(false)

  const [filterOpen, setFilterOpen] = useState(false)
  // Multi-select filters. Empty array = no filter on that axis. Tasks
  // must match at least one value per active axis (intersection across
  // axes, union within an axis), e.g. (status in {todo, in_review}) AND
  // (priority in {urgent}) AND ... .
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  // Sprint filter holds cycle ids. A task matches the filter if it belongs
  // to any selected sprint (via cycle.taskIds). Works for both admin and
  // members; member view stays scoped by their project visibility.
  const [sprintFilter, setSprintFilter] = useState<string[]>([])

  // Toggle helpers — flip a value's membership in a filter array. Used by
  // every surface (Sidebar, FilterPanel, SymbolsPanel) so the rule for
  // "click again to remove" lives in one place.
  const toggleStatus = (s: TaskStatus) => {
    setStatusFilter((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    )
  }
  const togglePriority = (p: TaskPriority) => {
    setPriorityFilter((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    )
  }
  const toggleAssignee = (id: string) => {
    setAssigneeFilter((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    )
  }
  const toggleTag = (tag: string) => {
    setTagFilter((cur) =>
      cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]
    )
  }
  const toggleSprint = (cycleId: string) => {
    setSprintFilter((cur) =>
      cur.includes(cycleId)
        ? cur.filter((x) => x !== cycleId)
        : [...cur, cycleId]
    )
  }

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Open task descriptor for the handoff sheet. Populated when a Done
  // move is blocked by the slice-2 handoff gate.
  const [handoffTaskTarget, setHandoffTaskTarget] = useState<{
    id: string
    ref: string
    title: string
  } | null>(null)
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
  // Help hints in the sidebar. Persisted to localStorage so members who
  // turn them off don't see them again on refresh. Defaults to on so the
  // first thing a new member sees explains the navigation.
  const [showHints, setShowHints] = useState(true)
  useEffect(() => {
    // Lazy initializer + suppressHydrationWarning would avoid this
    // setState, but only at the cost of a hydration mismatch (the
    // server can't read localStorage). One mount-time re-render is the
    // lesser evil here — `showHints` only flips a tiny ⓘ icon.
    const stored = window.localStorage.getItem('dashboard.showHints')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === '0') setShowHints(false)
  }, [])
  useEffect(() => {
    window.localStorage.setItem('dashboard.showHints', showHints ? '1' : '0')
  }, [showHints])

  const labelIdByName = useMemo(
    () => new Map(initial.labels.map((l) => [l.name, l.id])),
    [initial.labels]
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((task) => task.tags?.forEach((tag) => set.add(tag)))
    return [...set].sort()
  }, [tasks])

  // Server-side scoping in fetchDashboardData already narrows non-admin
  // tasks to "tasks in projects where I have ≥1 assignment". The 'mine'
  // view further narrows to just my-assignee tasks below.
  const visibleTasks = tasks

  // Task IDs where the current user is @mentioned in at least one comment.
  // Derived from local comment state so optimistic mentions show up
  // immediately in the count.
  const mentionedTaskIds = useMemo(() => {
    const set = new Set<string>()
    for (const [taskId, list] of Object.entries(comments)) {
      if (list.some((c) => c.mentions?.includes(currentUserId))) {
        set.add(taskId)
      }
    }
    return set
  }, [comments, currentUserId])

  const filtered = useMemo(() => {
    let list = visibleTasks

    if (view === 'mine')
      list = list.filter((task) => task.assignee?.id === currentUserId)
    if (view === 'inbox')
      list = list.filter(
        (task) => task.status === 'todo' || task.status === 'in_review'
      )
    if (view === 'mentions')
      list = list.filter((task) => mentionedTaskIds.has(task.id))

    if (statusFilter.length > 0) {
      list = list.filter((task) => statusFilter.includes(task.status))
    }
    if (priorityFilter.length > 0) {
      list = list.filter((task) => priorityFilter.includes(task.priority))
    }
    if (assigneeFilter.length > 0) {
      list = list.filter(
        (task) => task.assignee && assigneeFilter.includes(task.assignee.id)
      )
    }
    if (tagFilter.length > 0) {
      list = list.filter((task) =>
        task.tags?.some((tag) => tagFilter.includes(tag))
      )
    }
    if (sprintFilter.length > 0) {
      // Build the set of task ids that live in any selected sprint once,
      // then filter — avoids an O(filters × cycles × tasks) inner loop.
      const allowed = new Set<string>()
      for (const cycle of cycles) {
        if (sprintFilter.includes(cycle.id)) {
          for (const tid of cycle.taskIds) allowed.add(tid)
        }
      }
      list = list.filter((task) => allowed.has(task.id))
    }
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
    sprintFilter,
    cycles,
    query,
    currentUserId,
    mentionedTaskIds
  ])

  const counts = {
    all: visibleTasks.length,
    mine: visibleTasks.filter((task) => task.assignee?.id === currentUserId)
      .length,
    inbox: visibleTasks.filter(
      (task) => task.status === 'todo' || task.status === 'in_review'
    ).length,
    mentions: visibleTasks.filter((task) => mentionedTaskIds.has(task.id))
      .length
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
          {
            id: nextId('act'),
            kind: 'status',
            text,
            at: nowLabel(),
            atRaw: new Date().toISOString()
          }
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
    const taskRef = prev?.ref ?? null
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id
          ? { ...task, status: s, updatedAt: new Date().toISOString() }
          : task
      )
    )
    logActivityLocal(id, `Status set to ${STATUS_BY_ID[s].label}`)
    // Skip the toast when the status didn't actually change (drag landed
    // back in the same column). Avoids a flurry of "moved to X" pings.
    const movedToDifferentColumn = prevStatus !== undefined && prevStatus !== s
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
        if (res.reason === 'handoff-incomplete') {
          // Slice-2 gate (decision 0015, 0022). Pre-3a we bounced the
          // user to the standalone task edit page; now we open an inline
          // sheet so they never leave the dashboard.
          const blocked = prev
          if (blocked) {
            setHandoffTaskTarget({
              id: blocked.id,
              ref: blocked.ref,
              title: blocked.title
            })
          } else {
            toast.error(res.message)
          }
        } else {
          toast.error(res.message)
        }
        return
      }
      if (movedToDifferentColumn) {
        const prevLabel = prevStatus
          ? STATUS_BY_ID[prevStatus].label
          : 'previous'
        const nextLabel = STATUS_BY_ID[s].label
        const refPart = taskRef ? `${taskRef} ` : ''
        toast.success(`${refPart}moved to ${nextLabel}`, {
          description: `From ${prevLabel}.`,
          action: {
            label: 'Undo',
            onClick: () => updateStatus(id, prevStatus!)
          },
          duration: 4000
        })
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

  const addRelation = (taskId: string, rel: { kind: import('./status').RelationKind; ref: string }) => {
    // Optimistic append. If the server rejects (unknown ref, self-ref,
    // etc.) we roll back to the snapshot and toast the message.
    let snapshot: BoardTask[] | null = null
    setTasks((cur) => {
      snapshot = cur
      return cur.map((task) =>
        task.id === taskId
          ? {
              ...task,
              relations: [...(task.relations ?? []), rel]
            }
          : task
      )
    })
    startTransition(async () => {
      const res = await addTaskDependency({
        taskId,
        dependsOnRef: rel.ref,
        kind: rel.kind
      })
      if ('error' in res) {
        if (snapshot) setTasks(snapshot)
        toast.error(res.error)
      }
    })
  }

  const removeRelation = (
    taskId: string,
    rel: { kind: import('./status').RelationKind; ref: string }
  ) => {
    let snapshot: BoardTask[] | null = null
    setTasks((cur) => {
      snapshot = cur
      return cur.map((task) => {
        if (task.id !== taskId) return task
        const existing = task.relations ?? []
        return {
          ...task,
          relations: existing.filter(
            (r) => !(r.kind === rel.kind && r.ref === rel.ref)
          )
        }
      })
    })
    startTransition(async () => {
      const res = await removeTaskDependency({
        taskId,
        dependsOnRef: rel.ref,
        kind: rel.kind
      })
      if ('error' in res) {
        if (snapshot) setTasks(snapshot)
        toast.error(res.error)
      }
    })
  }

  const updateLead = (id: string, leadId: string | null) => {
    const member = leadId ? team.find((m) => m.id === leadId) : undefined
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id ? { ...task, lead: member ?? undefined } : task
      )
    )
    logActivityLocal(
      id,
      member ? `Lead set to ${member.name}` : 'Lead cleared'
    )
    startTransition(async () => {
      const res = await updateDashboardTaskLead(id, leadId)
      if ('error' in res) {
        console.error('updateLead:', res.error)
        toast.error("Couldn't update lead.")
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
            at: nowLabel(),
            atRaw: new Date().toISOString()
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

  const addExternalRef = (taskId: string, url: string) => {
    // Optimistic temp row — gets replaced by the server row on refresh.
    const tempId = nextId('ref')
    const parsed = parseExternalRefClient(url)
    const optimistic: TaskExternalRef = {
      id: tempId,
      taskId,
      kind: parsed?.kind ?? 'link',
      url: parsed?.url ?? url,
      label: null,
      createdAt: new Date().toISOString()
    }
    setExternalRefs((cur) => ({
      ...cur,
      [taskId]: [...(cur[taskId] ?? []), optimistic]
    }))
    startTransition(async () => {
      const res = await addTaskExternalRefAction({ taskId, url })
      if ('error' in res) {
        toast.error(res.error)
        setExternalRefs((cur) => ({
          ...cur,
          [taskId]: (cur[taskId] ?? []).filter((r) => r.id !== tempId)
        }))
        return
      }
      // Swap the optimistic row for the real one without a full refresh —
      // avoids the brief flash that router.refresh would cause.
      const saved = res.ref
      setExternalRefs((cur) => ({
        ...cur,
        [taskId]: (cur[taskId] ?? []).map((r) =>
          r.id === tempId
            ? {
                id: saved.id,
                taskId: saved.taskId,
                kind: saved.kind,
                url: saved.url,
                label: saved.label,
                createdAt:
                  saved.createdAt instanceof Date
                    ? saved.createdAt.toISOString()
                    : String(saved.createdAt)
              }
            : r
        )
      }))
    })
  }

  const removeExternalRef = (taskId: string, refId: string) => {
    let snapshot: TaskExternalRef[] | null = null
    setExternalRefs((cur) => {
      snapshot = cur[taskId] ?? []
      return {
        ...cur,
        [taskId]: (cur[taskId] ?? []).filter((r) => r.id !== refId)
      }
    })
    startTransition(async () => {
      const res = await removeTaskExternalRefAction(refId)
      if ('error' in res) {
        toast.error(res.error)
        if (snapshot) {
          setExternalRefs((cur) => ({ ...cur, [taskId]: snapshot! }))
        }
      }
    })
  }

  const addProjectExternalRef = (projectId: string, url: string) => {
    const tempId = nextId('pref')
    const parsed = parseExternalRefClient(url)
    const optimistic: ProjectExternalRef = {
      id: tempId,
      projectId,
      kind: parsed?.kind ?? 'link',
      url: parsed?.url ?? url,
      label: null,
      createdAt: new Date().toISOString()
    }
    setProjectExternalRefs((cur) => ({
      ...cur,
      [projectId]: [...(cur[projectId] ?? []), optimistic]
    }))
    startTransition(async () => {
      const res = await addProjectExternalRefAction({ projectId, url })
      if ('error' in res) {
        toast.error(res.error)
        setProjectExternalRefs((cur) => ({
          ...cur,
          [projectId]: (cur[projectId] ?? []).filter((r) => r.id !== tempId)
        }))
        return
      }
      const saved = res.ref
      setProjectExternalRefs((cur) => ({
        ...cur,
        [projectId]: (cur[projectId] ?? []).map((r) =>
          r.id === tempId
            ? {
                id: saved.id,
                projectId: saved.projectId,
                kind: saved.kind,
                url: saved.url,
                label: saved.label,
                createdAt:
                  saved.createdAt instanceof Date
                    ? saved.createdAt.toISOString()
                    : String(saved.createdAt)
              }
            : r
        )
      }))
    })
  }

  const removeProjectExternalRef = (projectId: string, refId: string) => {
    let snapshot: ProjectExternalRef[] | null = null
    setProjectExternalRefs((cur) => {
      snapshot = cur[projectId] ?? []
      return {
        ...cur,
        [projectId]: (cur[projectId] ?? []).filter((r) => r.id !== refId)
      }
    })
    startTransition(async () => {
      const res = await removeProjectExternalRefAction(refId)
      if ('error' in res) {
        toast.error(res.error)
        if (snapshot) {
          setProjectExternalRefs((cur) => ({
            ...cur,
            [projectId]: snapshot!
          }))
        }
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
          at: nowLabel(),
          atRaw: new Date().toISOString()
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
        leadId: draft.lead?.id ?? null,
        dueDate: null,
        labelIds,
        // The picker on ManualTab stores pending relations on draft.
        // Passed through to the server action as { kind, ref } pairs.
        relations: draft.relations?.map((rel) => ({
          kind: rel.kind,
          ref: rel.ref
        }))
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
        const next = { ...cur }
        delete next[tempId]
        return { ...next, [serverTask.id]: entry }
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
        if (res.reason === 'handoff-incomplete') {
          // Same inline-sheet path as the click-status flow.
          const blocked = tasks.find((t) => t.id === activeId)
          if (blocked) {
            setHandoffTaskTarget({
              id: blocked.id,
              ref: blocked.ref,
              title: blocked.title
            })
          } else {
            toast.error(res.message)
          }
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

  const createBulkTasks = async (
    targetProjectId: string,
    drafts: {
      title: string
      description: string | null
      status: TaskStatus
      priority: TaskPriority
      assigneeId: string | null
      dueDate: string | null
      labelIds: string[]
      newLabelNames: string[]
      relations?: {
        kind: 'blocked_by' | 'blocks' | 'parent' | 'sub_issue' | 'triage'
        ref: string
      }[]
    }[]
  ) => {
    const res = await createBulkDashboardTasks(targetProjectId, drafts)
    if ('error' in res) {
      console.error('createBulkTasks:', res.error)
      toast.error("Couldn't create tasks.")
      return
    }
    const taskMsg = `Created ${res.tasks.length} task${res.tasks.length === 1 ? '' : 's'}`
    const labelMsg =
      res.createdLabels.length > 0
        ? ` + ${res.createdLabels.length} new label${res.createdLabels.length === 1 ? '' : 's'}`
        : ''
    toast.success(taskMsg + labelMsg)
    // Server data refresh — bulk insert doesn't reuse the per-task
    // optimistic plumbing.
    router.refresh()
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
    setStatusFilter([])
    setPriorityFilter([])
    setAssigneeFilter([])
    setTagFilter([])
    setSprintFilter([])
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

  // Shared export context for every CopyButton on the page. The serializers
  // in lib/export consume this shape, so the Topbar / Project / Cycle /
  // Updates / Task buttons all reuse the same context build.
  const exportCtx: ExportContext = useMemo(
    () => ({
      tasks,
      cycles,
      projects: initial.projects,
      members: team,
      commentsByTask: comments,
      activityByTask: activity,
      refsByTask: externalRefs,
      refsByProject: projectExternalRefs
    }),
    [
      tasks,
      cycles,
      initial.projects,
      team,
      comments,
      activity,
      externalRefs,
      projectExternalRefs
    ]
  )

  const globalActivity = useMemo(() => {
    const all = Object.entries(activity).flatMap(([taskId, list]) => {
      const task = tasks.find((task) => task.id === taskId)
      return list.map((a) => ({
        id: a.id,
        kind: a.kind,
        text: a.text,
        at: a.at,
        atRaw: a.atRaw,
        taskId,
        taskRef: task?.ref ?? null,
        taskTitle: task?.title ?? null
      }))
    })
    return all.sort((a, b) => b.atRaw.localeCompare(a.atRaw))
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
    toggleStatusFilter: toggleStatus,
    clearStatusFilter: () => setStatusFilter([]),
    toggleAssigneeFilter: toggleAssignee,
    clearAssigneeFilter: () => setAssigneeFilter([])
  }

  const onProjectChange = (projectId: string | null) => {
    const params = new URLSearchParams()
    if (projectId) params.set('project', projectId)
    const qs = params.toString()
    router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  // Clicking a project card on the in-dashboard Projects panel should
  // both pin the project filter and surface the board (the card is the
  // "open this project" action — staying on the meta-panel afterward
  // would be confusing).
  const onOpenProject = (projectId: string) => {
    setView('all')
    onProjectChange(projectId)
  }

  // Quick filters are presets that map to specific combinations of the
  // multi-select state. A preset is "active" iff its target shape is
  // exactly what's in the filter arrays right now.
  const noFilters =
    statusFilter.length === 0 &&
    priorityFilter.length === 0 &&
    assigneeFilter.length === 0 &&
    tagFilter.length === 0
  const onlyPriority = (p: TaskPriority) =>
    priorityFilter.length === 1 &&
    priorityFilter[0] === p &&
    statusFilter.length === 0 &&
    assigneeFilter.length === 0 &&
    tagFilter.length === 0
  const onlyStatus = (s: TaskStatus) =>
    statusFilter.length === 1 &&
    statusFilter[0] === s &&
    priorityFilter.length === 0 &&
    assigneeFilter.length === 0 &&
    tagFilter.length === 0

  const activeQuickFilter: 'open' | 'due' | 'review' | 'done' | null =
    onlyPriority('urgent')
      ? 'due'
      : onlyStatus('in_review')
        ? 'review'
        : onlyStatus('done')
          ? 'done'
          : noFilters && !query.trim()
            ? 'open'
            : null

  const onQuickFilter = (kind: 'open' | 'due' | 'review' | 'done') => {
    if (kind === 'open') {
      resetFilters()
      return
    }
    if (kind === 'due') {
      setStatusFilter([])
      setPriorityFilter(onlyPriority('urgent') ? [] : ['urgent'])
      setAssigneeFilter([])
      setTagFilter([])
      return
    }
    if (kind === 'review') {
      setPriorityFilter([])
      setStatusFilter(onlyStatus('in_review') ? [] : ['in_review'])
      setAssigneeFilter([])
      setTagFilter([])
      return
    }
    setPriorityFilter([])
    setStatusFilter(onlyStatus('done') ? [] : ['done'])
    setAssigneeFilter([])
    setTagFilter([])
  }

  // Plain-language label for whichever view is currently active. Surfaces
  // in the top chrome (right of the user menu) so the user always sees
  // which scope they're in.
  const viewLabel = (() => {
    switch (view) {
      case 'mine':
        return 'My tasks'
      case 'inbox':
        return 'Inbox'
      case 'mentions':
        return 'Mentions'
      case 'projects':
        return 'Projects'
      case 'updates':
        return 'Updates'
      case 'symbols':
        return 'Symbols'
      case 'settings':
        return 'Settings'
      case 'archive':
        return 'Archive'
      case 'all':
      default:
        return 'All tasks'
    }
  })()

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
          className={`relative flex h-11 shrink-0 items-center justify-between border-b px-4 text-xs ${t.topbar}`}
        >
          <Link
            href="/portfolio"
            className={`flex items-center gap-1.5 transition ${t.backLink}`}
          >
            <ArrowLeft className="size-3" />
            Back to overview
          </Link>
          <span
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
          >
            Verbivore · Task Handoff
          </span>
          <div className="flex items-center gap-3">
            {assigneeFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setAssigneeFilter([])}
                title={
                  assigneeFilter.length === 1
                    ? `Inspecting ${
                        team.find((m) => m.id === assigneeFilter[0])?.name ??
                        'unknown'
                      } — click to clear`
                    : `Inspecting ${assigneeFilter.length} teammates — click to clear`
                }
                className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-1.5 text-[11px] transition ${t.btn}`}
              >
                <span
                  className={`text-[9px] tracking-[0.22em] uppercase ${t.textSubtle}`}
                >
                  Inspecting
                </span>
                <div className="flex items-center -space-x-1.5">
                  {assigneeFilter.slice(0, 3).map((id) => {
                    const member = team.find((m) => m.id === id)
                    if (!member) return null
                    return (
                      <span
                        key={id}
                        className="ring-background rounded-full ring-1"
                      >
                        <Avatar user={member} size={18} />
                      </span>
                    )
                  })}
                  {assigneeFilter.length > 3 && (
                    <span
                      className={`ring-background flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold ring-1 ${t.surfaceMuted} ${t.text}`}
                    >
                      +{assigneeFilter.length - 3}
                    </span>
                  )}
                </div>
                {assigneeFilter.length === 1 && (
                  <span className={`max-w-[120px] truncate ${t.text}`}>
                    {team.find((m) => m.id === assigneeFilter[0])?.name ??
                      'unknown'}
                  </span>
                )}
                <X className={`size-3 ${t.textSubtle}`} />
              </button>
            )}
            <CurrentUserMenu user={currentUser} isAdmin={isAdmin} />
          </div>
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
              onToggleStatus={toggleStatus}
              onClearStatus={() => setStatusFilter([])}
              assigneeFilter={assigneeFilter}
              onToggleAssignee={toggleAssignee}
              onClearAssignee={() => setAssigneeFilter([])}
              counts={counts}
              secondary={view}
              onSecondary={(v) => setView(v)}
              showHints={showHints}
              currentUserId={currentUserId}
            />
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {isPending && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
              >
                <div className="dashboard-loader-bar h-full w-1/4 rounded-r bg-teal-500" />
              </div>
            )}
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
              activeFilterCount={
                statusFilter.length +
                priorityFilter.length +
                assigneeFilter.length +
                tagFilter.length +
                sprintFilter.length
              }
              viewLabel={viewLabel}
              feedView={
                view === 'all' ||
                view === 'mine' ||
                view === 'inbox' ||
                view === 'mentions'
                  ? view
                  : 'all'
              }
              onFeedViewChange={(v) => setView(v)}
              copySlot={
                <CopyButton
                  primaryLabel="Copy page"
                  responsiveLabel
                  primaryToastLabel="page as Markdown"
                  primaryGetContent={() =>
                    buildViewMarkdown({
                      tasks: filtered,
                      ctx: exportCtx,
                      view,
                      groupBy,
                      currentProjectId: initial.currentProjectId,
                      projects: initial.projects
                    })
                  }
                  menu={buildViewCopyMenu({
                    filtered,
                    allTasks: tasks,
                    ctx: exportCtx,
                    view,
                    groupBy,
                    currentProjectId: initial.currentProjectId,
                    projects: initial.projects,
                    cycles
                  })}
                />
              }
            />

            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              statusFilter={statusFilter}
              onToggleStatus={toggleStatus}
              onClearStatus={() => setStatusFilter([])}
              priorityFilter={priorityFilter}
              onTogglePriority={togglePriority}
              onClearPriority={() => setPriorityFilter([])}
              assigneeFilter={assigneeFilter}
              onToggleAssignee={toggleAssignee}
              onClearAssignee={() => setAssigneeFilter([])}
              tagFilter={tagFilter}
              onToggleTag={toggleTag}
              onClearTag={() => setTagFilter([])}
              allTags={allTags}
              sprintFilter={sprintFilter}
              onToggleSprint={toggleSprint}
              onClearSprint={() => setSprintFilter([])}
              allSprints={cycles
                .filter(
                  (c) =>
                    !initial.currentProjectId ||
                    c.projectId === initial.currentProjectId
                )
                .map((c) => ({
                  id: c.id,
                  name: c.name,
                  status: c.status,
                  number: c.number
                }))}
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
                    label: 'New Task',
                    icon: <PlusCircle className="size-3.5" />,
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
              {(view === 'all' ||
                view === 'mine' ||
                view === 'inbox' ||
                view === 'mentions') && (
                <>
                  {tab === 'board' && (
                    <div className="flex h-full min-h-0 flex-col">
                      {initial.currentProjectId &&
                        (() => {
                          const currentCycle =
                            cycles.find(
                              (c) =>
                                c.projectId === initial.currentProjectId &&
                                c.status === 'current'
                            ) ?? null
                          return (
                            <CycleHero
                              cycle={currentCycle}
                              canEdit={
                                initial.currentMember.accessTier === 'admin' ||
                                initial.currentMember.accessTier === 'lead'
                              }
                              onPlan={() => setTab('cycles')}
                              onEdit={() => setTab('cycles')}
                              copySlot={
                                currentCycle ? (
                                  <CopyButton
                                    primaryLabel="Copy sprint"
                                    primaryToastLabel={`sprint ${currentCycle.name} as Markdown`}
                                    primaryGetContent={() =>
                                      cycleToMarkdown(currentCycle, exportCtx)
                                    }
                                    menu={[
                                      {
                                        id: 'md-full',
                                        label: 'Copy as Markdown',
                                        getContent: () =>
                                          cycleToMarkdown(
                                            currentCycle,
                                            exportCtx
                                          ),
                                        toastLabel: `sprint ${currentCycle.name} as Markdown`
                                      },
                                      {
                                        id: 'md-slim',
                                        label: 'Copy as Markdown (no comments)',
                                        getContent: () =>
                                          cycleToMarkdown(
                                            currentCycle,
                                            exportCtx,
                                            {
                                              withoutCommentsAndActivity: true
                                            }
                                          ),
                                        toastLabel: `sprint ${currentCycle.name} as Markdown`
                                      },
                                      {
                                        id: 'json-full',
                                        label: 'Copy as JSON',
                                        getContent: () =>
                                          cycleToJson(currentCycle, exportCtx),
                                        toastLabel: `sprint ${currentCycle.name} as JSON`
                                      },
                                      {
                                        id: 'json-slim',
                                        label: 'Copy as JSON (no comments)',
                                        getContent: () =>
                                          cycleToJson(currentCycle, exportCtx, {
                                            withoutCommentsAndActivity: true
                                          }),
                                        toastLabel: `sprint ${currentCycle.name} as JSON`
                                      }
                                    ]}
                                  />
                                ) : null
                              }
                            />
                          )
                        })()}
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
                        <div className="flex min-h-0 flex-1 [scrollbar-width:none] gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                                const t = tasks.find(
                                  (x) => x.id === activeDragId
                                )
                                return t ? (
                                  <div className="rotate-1 opacity-95 shadow-2xl">
                                    <TaskCard task={t} draggable={false} />
                                  </div>
                                ) : null
                              })()
                            : null}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  )}
                  {tab === 'list' && (
                    <ListView tasks={filtered} onSelect={setSelectedId} />
                  )}
                  {tab === 'timeline' && (
                    <Timeline tasks={filtered} onSelect={setSelectedId} />
                  )}
                  {tab === 'cycles' && initial.currentProjectId && (
                    <CyclesPanel
                      projectId={initial.currentProjectId}
                      cycles={cycles.filter(
                        (c) => c.projectId === initial.currentProjectId
                      )}
                      setCycles={setCycles}
                      tasks={tasks.filter(
                        (t) => t.projectId === initial.currentProjectId
                      )}
                      accessTier={initial.currentMember.accessTier}
                      onOpenTask={setSelectedId}
                      renderCycleCopySlot={(cycleId) => {
                        const c = cycles.find((x) => x.id === cycleId)
                        if (!c) return null
                        return (
                          <CopyButton
                            primaryLabel=""
                            iconOnly
                            primaryToastLabel={`sprint ${c.name} as Markdown`}
                            primaryGetContent={() =>
                              cycleToMarkdown(c, exportCtx)
                            }
                          />
                        )
                      }}
                    />
                  )}
                </>
              )}

              {view === 'projects' && (
                <ProjectsPanel
                  tasks={visibleTasks}
                  projects={initial.projects}
                  currentUserId={currentUserId}
                  accessTier={initial.currentMember.accessTier}
                  onOpenProject={onOpenProject}
                  refsByProject={projectExternalRefs}
                  onAddProjectRef={addProjectExternalRef}
                  onRemoveProjectRef={removeProjectExternalRef}
                  renderCopySlot={(projectId) => {
                    const project = initial.projects.find(
                      (p) => p.id === projectId
                    )
                    if (!project) return null
                    return (
                      <CopyButton
                        primaryLabel="Copy project"
                        primaryToastLabel={`${project.name} as Markdown`}
                        primaryGetContent={() =>
                          projectToMarkdown(project, exportCtx)
                        }
                        menu={[
                          {
                            id: 'md-full',
                            label: 'Copy as Markdown',
                            description: 'With comments + activity',
                            getContent: () =>
                              projectToMarkdown(project, exportCtx),
                            toastLabel: `${project.name} as Markdown`
                          },
                          {
                            id: 'md-slim',
                            label: 'Copy as Markdown (no comments)',
                            getContent: () =>
                              projectToMarkdown(project, exportCtx, {
                                withoutCommentsAndActivity: true
                              }),
                            toastLabel: `${project.name} as Markdown`
                          },
                          {
                            id: 'json-full',
                            label: 'Copy as JSON',
                            description: 'Versioned shape for agent ingestion',
                            getContent: () => projectToJson(project, exportCtx),
                            toastLabel: `${project.name} as JSON`
                          },
                          {
                            id: 'json-slim',
                            label: 'Copy as JSON (no comments)',
                            getContent: () =>
                              projectToJson(project, exportCtx, {
                                withoutCommentsAndActivity: true
                              }),
                            toastLabel: `${project.name} as JSON`
                          }
                        ]}
                      />
                    )
                  }}
                />
              )}
              {view === 'updates' && (
                <UpdatesPanel
                  activity={globalActivity}
                  onOpenTask={(id) => setSelectedId(id)}
                />
              )}
              {view === 'symbols' && (
                <SymbolsPanel
                  tasks={visibleTasks}
                  cycles={cycles}
                  refsByTask={externalRefs}
                  refsByProject={projectExternalRefs}
                  onFilterByStatus={(status) => {
                    setStatusFilter([status])
                    setPriorityFilter([])
                    setView('all')
                    setTab('board')
                  }}
                  onFilterByPriority={(priority) => {
                    setPriorityFilter([priority])
                    setStatusFilter([])
                    setView('all')
                    setTab('board')
                  }}
                />
              )}
              {view === 'archive' && (
                <ArchivePanel
                  cycles={cycles}
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
                  showHints={showHints}
                  setShowHints={setShowHints}
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
                showCloseButton={false}
                className={`w-full p-0 sm:!max-w-[640px] ${t.detail}`}
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
                    externalRefs={externalRefs[selected.id] ?? []}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedId(null)}
                    onChangeStatus={updateStatus}
                    onChangePriority={updatePriority}
                    onChangeAssignee={updateAssignee}
                    onChangeLead={updateLead}
                    onAddComment={addComment}
                    onEditComment={editComment}
                    onDeleteComment={deleteComment}
                    onAddExternalRef={addExternalRef}
                    onRemoveExternalRef={removeExternalRef}
                    candidateTasks={tasks.map((task) => ({
                      id: task.id,
                      ref: task.ref,
                      title: task.title,
                      status: task.status
                    }))}
                    onAddRelation={addRelation}
                    onRemoveRelation={removeRelation}
                    onOpenHandoff={(task) =>
                      setHandoffTaskTarget({
                        id: task.id,
                        ref: task.ref,
                        title: task.title
                      })
                    }
                    copySlot={
                      <CopyButton
                        primaryLabel="Copy"
                        primaryToastLabel="task as Markdown"
                        primaryGetContent={() =>
                          taskToMarkdown(selected, exportCtx)
                        }
                        menu={[
                          {
                            id: 'md-full',
                            label: 'Copy as Markdown',
                            description: 'With comments + activity',
                            getContent: () =>
                              taskToMarkdown(selected, exportCtx),
                            toastLabel: 'task as Markdown'
                          },
                          {
                            id: 'md-slim',
                            label: 'Copy as Markdown (no comments)',
                            getContent: () =>
                              taskToMarkdown(selected, exportCtx, {
                                withoutCommentsAndActivity: true
                              }),
                            toastLabel: 'task as Markdown'
                          },
                          {
                            id: 'json-full',
                            label: 'Copy as JSON',
                            description: 'Versioned shape for agent ingestion',
                            getContent: () => taskToJson(selected, exportCtx),
                            toastLabel: 'task as JSON'
                          },
                          {
                            id: 'json-slim',
                            label: 'Copy as JSON (no comments)',
                            getContent: () =>
                              taskToJson(selected, exportCtx, {
                                withoutCommentsAndActivity: true
                              }),
                            toastLabel: 'task as JSON'
                          }
                        ]}
                      />
                    }
                  />
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <HandoffSheet
          task={handoffTaskTarget}
          refs={
            handoffTaskTarget ? (externalRefs[handoffTaskTarget.id] ?? []) : []
          }
          onAddRef={addExternalRef}
          onRemoveRef={removeExternalRef}
          members={team}
          onClose={() => setHandoffTaskTarget(null)}
          onDone={(taskId) => {
            // The server has already moved the task to Done. Apply the
            // same local effect we would have if the gate had passed on
            // the first try: flip status + log activity.
            setTasks((cur) =>
              cur.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      status: 'done',
                      updatedAt: new Date().toISOString()
                    }
                  : task
              )
            )
            logActivityLocal(taskId, 'Status set to Done')
          }}
        />

        <NewTaskModal
          open={newTaskOpen}
          defaultStatus={newTaskColumn}
          members={team}
          labels={initial.labels}
          projects={initial.allActiveProjects}
          defaultProjectId={
            initial.currentProjectId ?? initial.defaultProjectId
          }
          candidateTasks={tasks.map((task) => ({
            id: task.id,
            ref: task.ref,
            title: task.title,
            status: task.status
          }))}
          onClose={() => setNewTaskOpen(false)}
          onCreate={createTask}
          onCreateBulk={createBulkTasks}
        />
      </div>
    </TaskActionsProvider>
  )
}

function CurrentUserMenu({
  user,
  isAdmin
}: {
  user: BoardAssignee
  isAdmin: boolean
}) {
  const { t } = useDashTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const roleLabel = isAdmin ? 'Admin' : 'Member'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
        className={`flex items-center gap-2 rounded-full border px-2 py-1 transition ${
          open ? t.btnActive : t.btn
        }`}
      >
        <Avatar user={user} size={22} />
        <span className={`text-xs ${t.text} hidden sm:inline`}>
          {user.name}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${
            isAdmin
              ? 'bg-teal-500/15 text-teal-500'
              : `${t.surfaceMuted} ${t.textMuted}`
          }`}
        >
          {roleLabel}
        </span>
        <ChevronDown
          className={`size-3 ${t.textSubtle} transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-9 right-0 z-40 w-56 rounded-md border py-1 shadow-xl ${t.detail}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar user={user} size={28} />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className={`truncate text-xs font-medium ${t.text}`}>
                {user.name}
              </span>
              <span
                className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
          <div className={`my-1 border-t ${t.borderSoft}`} />
          <form action={signOut}>
            <button
              type="submit"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab} ${t.accentText}`}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      )}
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
