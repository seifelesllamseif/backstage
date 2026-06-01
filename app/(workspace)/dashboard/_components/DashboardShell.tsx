'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  RotateCcw,
  Sun,
  Moon,
  X,
  PlusCircle
} from 'lucide-react'
import { signOut } from '@/app/(authentication)/login/actions'
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
  updateProjectExternalRefLabel as updateProjectExternalRefLabelAction,
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
  updateDashboardTaskDetails,
  updateDashboardTaskDueDate,
  updateDashboardTaskLead,
  updateDashboardTaskPriority,
  updateDashboardTaskStatus,
  addTaskDependency,
  removeTaskDependency
} from '../actions'
import { parseExternalRef as parseExternalRefClient } from '@/lib/externalRef'
import type { BoardAssignee, BoardTask, Sprint } from './boardData'
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
import SprintsPanel from './SprintsPanel'
import SprintHero from './SprintHero'
import HandoffSheet from './HandoffSheet'
import { CopyButton, type CopyMenuItem } from '@/components/ui/copy-button'
import { viewToJson, viewToMarkdown } from '@/lib/export/view'
import { sprintToJson, sprintToMarkdown } from '@/lib/export/sprint'
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
import { PortfolioSheetProvider } from './PortfolioSheet'
import { useDashboardSearchParams } from './useDashboardSearchParams'

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
  sprints: Sprint[]
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
    onboardingComplete: boolean
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

type Greeting = { text: string; emoji: string }

function greetingForNow(): Greeting {
  const h = new Date().getHours()
  if (h < 5) return { text: 'Up late', emoji: '🌙' }
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤' }
  if (h < 21) return { text: 'Good evening', emoji: '✨' }
  return { text: 'Good night', emoji: '🌙' }
}

// Re-evaluates the time-banded greeting once a minute. The setState only
// fires when the text actually changes, so React skips re-renders unless we
// cross an hour boundary - the transition is naturally "slow".
function useGreeting(): Greeting {
  const [g, setG] = useState<Greeting>(() => greetingForNow())
  useEffect(() => {
    const id = setInterval(() => {
      const next = greetingForNow()
      setG((cur) => (cur.text === next.text ? cur : next))
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return g
}

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

type ActiveTab = 'board' | 'list' | 'timeline' | 'sprints'

const PANEL_VIEWS = [
  'projects',
  'updates',
  'settings',
  'symbols',
  'archive'
] as const
type PanelView = (typeof PANEL_VIEWS)[number]

function pathTabFor(pathname: string | null): ActiveTab {
  if (pathname === '/dashboard/list') return 'list'
  if (pathname === '/dashboard/timeline') return 'timeline'
  if (pathname === '/dashboard/sprints') return 'sprints'
  return 'board'
}

function pathPanelFor(pathname: string | null): PanelView | null {
  if (!pathname) return null
  const seg = pathname.replace(/^\/dashboard\//, '')
  return (PANEL_VIEWS as readonly string[]).includes(seg)
    ? (seg as PanelView)
    : null
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
  scope: Exclude<TimeScope, 'all' | 'sprint'>
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
  sprints: Sprint[]
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

  const projectScopedSprints = args.currentProjectId
    ? args.sprints.filter((c) => c.projectId === args.currentProjectId)
    : args.sprints
  if (projectScopedSprints.length > 0) {
    items.push({
      id: 'by-sprint',
      label: 'Copy by sprint',
      description: 'Pick a sprint to export',
      separatorBefore: true,
      submenu: projectScopedSprints.map((c) => ({
        id: `sprint-${c.id}`,
        label: `${c.name} (${c.status})`,
        getContent: () => sprintToMarkdown(c, args.ctx),
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
          <PortfolioSheetProvider>
            <DashboardShellInner {...props} />
          </PortfolioSheetProvider>
        </TeamProvider>
      </ContextMenuProvider>
    </DashboardThemeProvider>
  )
}

function DashboardShellInner({ initial }: { initial: DashboardInitial }) {
  const { t, toggle, mode } = useDashTheme()
  const { open: openMenu } = useContextMenu()
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const queryClient = useQueryClient()
  // Invalidates the React Query cache that DashboardChrome reads from.
  // Pair with router.refresh() in flows that previously assumed server-fetched
  // data (bulk insert, hard resets) - the per-task optimistic plumbing
  // doesn't go through here.
  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboardInitial'] })
  }
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
  const greeting = useGreeting()
  const firstName = currentUser.name.split(/\s+/)[0]
  // Alternates the centered wordmark between the time-banded greeting and
  // the static "Verbivore · Task Handoff" mark. Slow cadence so the swap
  // feels ambient, not animated; bump this constant to taste.
  const [wordmarkPhase, setWordmarkPhase] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setWordmarkPhase((i) => i + 1), 180_000)
    return () => clearInterval(id)
  }, [])
  const showGreetingPhase = wordmarkPhase % 2 === 0

  const [tasks, setTasks] = useState<BoardTask[]>(initial.tasks)
  const [comments, setComments] = useState<Record<string, TaskComment[]>>(
    initial.commentsByTask
  )
  const [activity, setActivity] = useState<Record<string, TaskActivity[]>>(
    initial.activityByTask
  )
  const [sprints, setSprints] = useState<Sprint[]>(initial.sprints)
  const [externalRefs, setExternalRefs] = useState<
    Record<string, TaskExternalRef[]>
  >(initial.externalRefsByTask)
  const [projectExternalRefs, setProjectExternalRefs] = useState<
    Record<string, ProjectExternalRef[]>
  >(initial.externalRefsByProject)

  // Resync local state when the server hands us fresh data via router.refresh
  // (bulk create, "reset board", project switch). Per-mutation flows update
  // local state optimistically and don't refresh, so this only fires at the
  // moments where the server is the source of truth. Uses render-time state
  // adjustment (React-recommended) instead of effects.
  const [prevInitial, setPrevInitial] = useState(initial)
  if (prevInitial.tasks !== initial.tasks) {
    setPrevInitial(initial)
    setTasks(initial.tasks)
    setComments(initial.commentsByTask)
    setActivity(initial.activityByTask)
    setSprints(initial.sprints)
    setExternalRefs(initial.externalRefsByTask)
    setProjectExternalRefs(initial.externalRefsByProject)
  }

  // The active tab + view + feed are all derived from the URL (pathname for
  // the route, search params for feed) so that browser back/forward, refresh,
  // and link-sharing all reproduce the same surface. Sidebar panels live at
  // their own routes (/dashboard/projects etc.); feeds (all/mine/inbox/
  // mentions) overlay the tab routes via ?feed=.
  const pathname = usePathname()
  const tab = pathTabFor(pathname)
  const panel = pathPanelFor(pathname)
  const setTab = (next: 'board' | 'list' | 'timeline' | 'sprints') => {
    const qs = currentSearchParams.toString()
    router.push(qs ? `/dashboard/${next}?${qs}` : `/dashboard/${next}`)
  }

  const [groupOpen, setGroupOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Multi-select filters, search query, and group-by all live in the URL
  // so reloads, browser back/forward, and link-sharing all reproduce the
  // same view. Tasks must match at least one value per active axis
  // (intersection across axes, union within an axis), e.g. (status in
  // {todo, in_review}) AND (priority in {urgent}) AND ... .
  // Pass team so the hook can translate ?assignee=<uuid> <-> ?assignee=<slug>
  // for readable share URLs.
  const urlParams = useDashboardSearchParams({ members: team })
  const {
    statusFilter,
    priorityFilter,
    assigneeFilter,
    tagFilter,
    sprintFilter,
    query,
    groupBy,
    setStatusFilter,
    toggleStatus,
    setPriorityFilter,
    togglePriority,
    setAssigneeFilter,
    toggleAssignee,
    setTagFilter,
    toggleTag,
    setSprintFilter,
    toggleSprint,
    setQuery,
    setGroupBy,
    feed,
    resetFilters,
    applyFilters
  } = urlParams

  // The shell historically had a single `view` state covering both feeds
  // (all/mine/inbox/mentions) and sidebar panels (projects/updates/...).
  // Today those live in different URL surfaces: panel = route segment,
  // feed = search param. We rebuild the union here so the rest of the
  // shell can keep treating `view` as a single value.
  const view: View = panel ?? feed
  const setView = (next: View) => {
    if ((PANEL_VIEWS as readonly string[]).includes(next)) {
      // Panels live at their own routes. Search params for filter state
      // carry across, but `feed` is dropped because panels ignore it.
      const params = new URLSearchParams(currentSearchParams.toString())
      params.delete('feed')
      const qs = params.toString()
      router.push(qs ? `/dashboard/${next}?${qs}` : `/dashboard/${next}`)
      return
    }
    // Feed change. If we're on a panel route, jump back to the Board with
    // the new feed pinned. Otherwise stay on the current tab and just
    // update ?feed=. Use router.push (not the hook's replace) so the back
    // button restores the previous feed - feed changes feel like
    // navigation, unlike filter toggles.
    const params = new URLSearchParams(currentSearchParams.toString())
    if (next === 'all') params.delete('feed')
    else params.set('feed', next)
    const qs = params.toString()
    const route = panel
      ? '/dashboard/board'
      : pathname && pathname.startsWith('/dashboard/')
        ? pathname
        : '/dashboard/board'
    router.push(qs ? `${route}?${qs}` : route)
  }

  // Deep-link: open the task slide-over when ?task=<ref> is in the URL.
  // Used by the public /share/<ref> page's "Open in Backstage" CTA.
  // Derives the initial selectedId during render to avoid setState inside
  // an effect; then strips the param via router.replace in an effect.
  const deepLinkRef = currentSearchParams.get('task')
  const deepLinkMatch = deepLinkRef
    ? tasks.find((t) => t.ref === deepLinkRef)
    : undefined
  const [selectedId, setSelectedId] = useState<string | null>(
    deepLinkMatch?.id ?? null
  )
  const [handledDeepLink, setHandledDeepLink] = useState<string | null>(null)
  if (deepLinkRef && deepLinkMatch && handledDeepLink !== deepLinkRef) {
    setHandledDeepLink(deepLinkRef)
    setSelectedId(deepLinkMatch.id)
  }
  // Strip the ?task= param after handling so a refresh / share doesn't
  // keep forcing the same task open.
  useEffect(() => {
    if (!deepLinkRef || !deepLinkMatch) return
    const params = new URLSearchParams(currentSearchParams.toString())
    params.delete('task')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [deepLinkRef, deepLinkMatch, currentSearchParams, router, pathname])
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
  // Prefill carried into the New Task modal when the user clicks "Add"
  // inside a non-status board column (Group: Assignee / Group: Priority).
  // undefined = no prefill; the modal falls back to its own defaults.
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<
    string | null | undefined
  >(undefined)
  const [newTaskPriority, setNewTaskPriority] = useState<
    TaskPriority | undefined
  >(undefined)

  // Require 6px of movement before drag activates — single clicks on
  // cards keep opening the drawer (no accidental drags).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const [density, setDensity] = useState<'compact' | 'cozy'>(() => {
    if (typeof window === 'undefined') return 'cozy'
    const stored = window.localStorage.getItem('dashboard.density')
    return stored === 'compact' || stored === 'cozy' ? stored : 'cozy'
  })
  const [wipLimit, setWipLimit] = useState(() => {
    if (typeof window === 'undefined') return 0
    const stored = window.localStorage.getItem('dashboard.wipLimit')
    if (stored !== null) {
      const n = Number(stored)
      if (Number.isFinite(n) && n >= 0) return n
    }
    return 0
  })
  // Mobile-only: controls the Sheet that wraps the Sidebar on small
  // screens. Always false on desktop because the static sidebar covers it.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Help hints in the sidebar. Persisted to localStorage so members who
  // turn them off don't see them again on refresh. Defaults to on so the
  // first thing a new member sees explains the navigation. Lazy
  // initializers read localStorage on the client; SSR falls back to the
  // default value (visual-only state, no meaningful hydration mismatch).
  const [showHints, setShowHints] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('dashboard.showHints') !== '0'
  })
  useEffect(() => {
    window.localStorage.setItem('dashboard.showHints', showHints ? '1' : '0')
  }, [showHints])
  useEffect(() => {
    window.localStorage.setItem('dashboard.density', density)
  }, [density])
  useEffect(() => {
    window.localStorage.setItem('dashboard.wipLimit', String(wipLimit))
  }, [wipLimit])

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

  // Task IDs where the current user is @mentioned AND hasn't replied yet.
  // The rule: a task stays in the Mentions feed until the user posts a
  // comment newer than the most recent comment that mentioned them.
  // Replying acknowledges + closes the loop; the task drops out
  // automatically. No read-tracking table needed.
  //
  // Derived from local comment state so optimistic mentions + replies show
  // up immediately.
  const mentionedTaskIds = useMemo(() => {
    const set = new Set<string>()
    for (const [taskId, list] of Object.entries(comments)) {
      let latestMentionAt: string | null = null
      let latestMineAt: string | null = null
      for (const c of list) {
        if (c.mentions?.includes(currentUserId)) {
          if (!latestMentionAt || c.createdAt > latestMentionAt) {
            latestMentionAt = c.createdAt
          }
        }
        if (c.authorId === currentUserId) {
          if (!latestMineAt || c.createdAt > latestMineAt) {
            latestMineAt = c.createdAt
          }
        }
      }
      if (!latestMentionAt) continue
      // Self-mentions don't count (no one nags themselves).
      if (latestMineAt && latestMineAt >= latestMentionAt) continue
      set.add(taskId)
    }
    return set
  }, [comments, currentUserId])

  // Task ids that live in any sprint currently marked `current`. Returns
  // null when no sprint is active so callers can fall back to the prior
  // unscoped behavior (mainly the Inbox / sprint-focus view).
  const activeSprintTaskIdSet = useMemo<Set<string> | null>(() => {
    const current = sprints.filter((s) => s.status === 'current')
    if (current.length === 0) return null
    const set = new Set<string>()
    for (const s of current) {
      for (const id of s.taskIds) set.add(id)
    }
    return set
  }, [sprints])

  const filtered = useMemo(() => {
    let list = visibleTasks

    if (view === 'mine')
      list = list.filter((task) => task.assignee?.id === currentUserId)
    if (view === 'inbox') {
      // "Sprint focus" view: actionable statuses in the active sprint(s).
      // If no sprint is currently active, fall back to all actionable tasks
      // so the view still shows something useful.
      list = list.filter((task) => {
        const actionable =
          task.status === 'todo' || task.status === 'in_review'
        if (!actionable) return false
        if (activeSprintTaskIdSet === null) return true
        return activeSprintTaskIdSet.has(task.id)
      })
    }
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
      // then filter — avoids an O(filters × sprints × tasks) inner loop.
      const allowed = new Set<string>()
      for (const sprint of sprints) {
        if (sprintFilter.includes(sprint.id)) {
          for (const tid of sprint.taskIds) allowed.add(tid)
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
    sprints,
    query,
    currentUserId,
    mentionedTaskIds,
    activeSprintTaskIdSet
  ])

  const counts = {
    all: visibleTasks.length,
    mine: visibleTasks.filter((task) => task.assignee?.id === currentUserId)
      .length,
    inbox: visibleTasks.filter((task) => {
      const actionable =
        task.status === 'todo' || task.status === 'in_review'
      if (!actionable) return false
      if (activeSprintTaskIdSet === null) return true
      return activeSprintTaskIdSet.has(task.id)
    }).length,
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

  const addRelation = (
    taskId: string,
    rel: { kind: import('./status').RelationKind; ref: string }
  ) => {
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

  const updateDueDate = (id: string, dueIso: string | null) => {
    // Optimistic update on the task row. The server action also handles
    // the "postponed" / "early" auto-tag swap on a non-null previous date,
    // so we invalidateDashboard once the action returns to pull the new
    // tag set back through React Query.
    const newDisplay = dueIso
      ? new Date(dueIso).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      : undefined
    const newAt = dueIso ? new Date(dueIso).toISOString() : undefined
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id ? { ...task, due: newDisplay, dueAt: newAt } : task
      )
    )
    startTransition(async () => {
      const res = await updateDashboardTaskDueDate(id, dueIso)
      if ('error' in res) {
        console.error('updateDueDate:', res.error)
        toast.error(res.error)
        return
      }
      invalidateDashboard()
    })
  }

  const updateTitle = (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    setTasks((cur) =>
      cur.map((task) => (task.id === id ? { ...task, title: trimmed } : task))
    )
    startTransition(async () => {
      const res = await updateDashboardTaskDetails({
        taskId: id,
        title: trimmed
      })
      if ('error' in res) {
        console.error('updateTitle:', res.error)
        toast.error("Couldn't update title.")
      }
    })
  }

  const updateDescription = (id: string, description: string | null) => {
    const next = description === null ? null : description.trim()
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id ? { ...task, description: next } : task
      )
    )
    startTransition(async () => {
      const res = await updateDashboardTaskDetails({
        taskId: id,
        description: next
      })
      if ('error' in res) {
        console.error('updateDescription:', res.error)
        toast.error("Couldn't update description.")
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
    logActivityLocal(id, member ? `Lead set to ${member.name}` : 'Lead cleared')
    startTransition(async () => {
      const res = await updateDashboardTaskLead(id, leadId)
      if ('error' in res) {
        console.error('updateLead:', res.error)
        toast.error("Couldn't update lead.")
      }
    })
  }

  const addComment = (id: string, body: string, mentions?: string[]) => {
    // Track the temp id so we can swap it for the server-assigned UUID
    // once the insert returns. Without the swap, deleting / editing a
    // just-posted comment hits the server with a synthetic id and errors
    // out with "Comment not found".
    const tempId = nextId('cm')
    const nowIso = new Date().toISOString()
    setComments((cur) => {
      const list = cur[id] ?? []
      return {
        ...cur,
        [id]: [
          ...list,
          {
            id: tempId,
            author: currentUser.name,
            authorId: currentUserId,
            authorInitials: currentUser.initials,
            body,
            at: nowLabel(),
            createdAt: nowIso,
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
        // Roll the temp row back so a retry doesn't double-post.
        setComments((cur) => ({
          ...cur,
          [id]: (cur[id] ?? []).filter((c) => c.id !== tempId)
        }))
        return
      }
      // Swap the temp id for the real server-assigned UUID so subsequent
      // edits/deletes reference the persisted row.
      const realId = res.comment.id
      setComments((cur) => ({
        ...cur,
        [id]: (cur[id] ?? []).map((c) =>
          c.id === tempId ? { ...c, id: realId } : c
        )
      }))
    })
  }

  const editComment = (commentId: string, body: string) => {
    // Optimistic: update body + mark editedAt locally so the "(edited)"
    // tag flips immediately. Also push an Updates row to mirror what the
    // server logs as comment.edited.
    const nowIso = new Date().toISOString()
    let taskIdForActivity: string | null = null
    setComments((cur) => {
      const next: typeof cur = {}
      for (const [taskId, list] of Object.entries(cur)) {
        const has = list.some((c) => c.id === commentId)
        if (has) taskIdForActivity = taskId
        next[taskId] = list.map((c) =>
          c.id === commentId ? { ...c, body, editedAt: nowIso } : c
        )
      }
      return next
    })
    if (taskIdForActivity) {
      const taskId = taskIdForActivity
      setActivity((cur) => ({
        ...cur,
        [taskId]: [
          ...(cur[taskId] ?? []),
          {
            id: nextId('act'),
            kind: 'comment',
            text: 'You edited a comment',
            at: nowLabel(),
            atRaw: nowIso
          }
        ]
      }))
    }
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
    // Also push an Updates row to mirror comment.deleted on the server.
    const nowIso = new Date().toISOString()
    let snapshot: typeof comments | null = null
    let taskIdForActivity: string | null = null
    setComments((cur) => {
      snapshot = cur
      const next: typeof cur = {}
      for (const [taskId, list] of Object.entries(cur)) {
        if (list.some((c) => c.id === commentId)) taskIdForActivity = taskId
        next[taskId] = list.filter((c) => c.id !== commentId)
      }
      return next
    })
    if (taskIdForActivity) {
      const taskId = taskIdForActivity
      setActivity((cur) => ({
        ...cur,
        [taskId]: [
          ...(cur[taskId] ?? []),
          {
            id: nextId('act'),
            kind: 'comment',
            text: 'You deleted a comment',
            at: nowLabel(),
            atRaw: nowIso
          }
        ]
      }))
    }
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
                createdAt: String(saved.createdAt)
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
                createdAt: String(saved.createdAt)
              }
            : r
        )
      }))
    })
  }

  const renameProjectExternalRef = (
    projectId: string,
    refId: string,
    nextLabel: string | null
  ) => {
    let snapshot: ProjectExternalRef[] | null = null
    setProjectExternalRefs((cur) => {
      snapshot = cur[projectId] ?? []
      return {
        ...cur,
        [projectId]: (cur[projectId] ?? []).map((r) =>
          r.id === refId ? { ...r, label: nextLabel } : r
        )
      }
    })
    startTransition(async () => {
      const res = await updateProjectExternalRefLabelAction({
        refId,
        label: nextLabel
      })
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
    draft: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'> & {
      description?: string | null
    }
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
        description: draft.description ?? null,
        status: draft.status,
        priority: draft.priority,
        projectId: targetProjectId,
        assigneeId: draft.assignee?.id ?? null,
        leadId: draft.lead?.id ?? null,
        dueDate: null,
        labelIds,
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
                createdAt: String(serverTask.createdAt).slice(0, 10),
                updatedAt: String(serverTask.updatedAt)
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
    setNewTaskAssigneeId(undefined)
    setNewTaskPriority(undefined)
    setNewTaskOpen(true)
  }

  // Open the New Task modal with a column-aware prefill. Used by the
  // empty-state "Click to add a task" button on board columns when the
  // board is grouped by Assignee or Priority (status grouping uses
  // openNewTask directly with the column's status).
  const openNewTaskWith = (opts: {
    status?: TaskStatus
    assigneeId?: string | null
    priority?: TaskPriority
  }) => {
    setNewTaskColumn(opts.status ?? 'todo')
    setNewTaskAssigneeId(opts.assigneeId)
    setNewTaskPriority(opts.priority)
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
    // Bulk insert doesn't reuse the per-task optimistic plumbing, so we
    // refetch via React Query (DashboardChrome) and refresh server
    // segments for any consumers still on the SSR path.
    invalidateDashboard()
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
                createdAt: String(serverTask.createdAt).slice(0, 10),
                updatedAt: String(serverTask.updatedAt)
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

  // Build the absolute share URL for a task and copy it to clipboard.
  // Used by the Share button in the task drawer and the context-menu
  // entry on board cards. Uses window.location.origin so it works on
  // any deploy without an env baseUrl.
  const copyShareLink = (taskRef: string) => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/share/${taskRef}`
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Share link copied'))
        .catch(() => toast.error("Couldn't copy link"))
    }
  }

  const selected = selectedId
    ? (tasks.find((task) => task.id === selectedId) ?? null)
    : null

  // Shared export context for every CopyButton on the page. The serializers
  // in lib/export consume this shape, so the Topbar / Project / Sprint /
  // Updates / Task buttons all reuse the same context build.
  const exportCtx: ExportContext = useMemo(
    () => ({
      tasks,
      sprints,
      projects: initial.projects,
      members: team,
      commentsByTask: comments,
      activityByTask: activity,
      refsByTask: externalRefs,
      refsByProject: projectExternalRefs
    }),
    [
      tasks,
      sprints,
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
    copyShareLink,
    openDetail: setSelectedId,
    addInColumn: openNewTask,
    toggleStatusFilter: toggleStatus,
    clearStatusFilter: () => setStatusFilter([]),
    toggleAssigneeFilter: toggleAssignee,
    clearAssigneeFilter: () => setAssigneeFilter([]),
    canDeleteTasks:
      initial.currentMember.accessTier === 'admin' ||
      initial.currentMember.accessTier === 'lead'
  }

  const onProjectChange = (projectId: string | null) => {
    const params = new URLSearchParams(currentSearchParams.toString())
    if (projectId) params.set('project', projectId)
    else params.delete('project')
    const qs = params.toString()
    // Stay on the current route. If the user is on /dashboard/sprints with
    // no project after the change, the server-side guard in sprints/page.tsx
    // will redirect to /dashboard/board.
    const route =
      pathname && pathname.startsWith('/dashboard/')
        ? pathname
        : '/dashboard/board'
    router.push(qs ? `${route}?${qs}` : route)
  }

  // Clicking a project card on the in-dashboard Projects panel should
  // both pin the project filter and surface the board (the card is the
  // "open this project" action — staying on the meta-panel afterward
  // would be confusing). Combined into a single router.push so the panel
  // change and the project change land in one navigation, not two racing
  // ones reading stale pathname.
  const onOpenProject = (projectId: string) => {
    const params = new URLSearchParams(currentSearchParams.toString())
    params.set('project', projectId)
    params.delete('feed')
    const qs = params.toString()
    router.push(qs ? `/dashboard/board?${qs}` : '/dashboard/board')
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
      applyFilters({
        status: [],
        priority: onlyPriority('urgent') ? [] : ['urgent'],
        assignee: [],
        tag: []
      })
      return
    }
    if (kind === 'review') {
      applyFilters({
        priority: [],
        status: onlyStatus('in_review') ? [] : ['in_review'],
        assignee: [],
        tag: []
      })
      return
    }
    applyFilters({
      priority: [],
      status: onlyStatus('done') ? [] : ['done'],
      assignee: [],
      tag: []
    })
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
        className={`fixed inset-0 flex flex-col overflow-hidden font-(--font-favorit) ${t.page}`}
      >
        <div
          onWheel={(e) => {
            if (view !== 'archive') return
            const scroller = document.querySelector<HTMLElement>(
              '[data-archive-scroll]'
            )
            if (scroller) scroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
          }}
          className={`relative flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3 text-xs sm:px-4 ${t.topbar}`}
        >
          <Link
            href="/portfolio"
            aria-label="Back to overview"
            className={`flex items-center gap-1.5 transition ${t.backLink}`}
          >
            <ArrowLeft className="size-3" />
            <span className="hidden sm:inline">Back to overview</span>
          </Link>
          <span
            aria-live="polite"
            className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 truncate text-[11px] tracking-wider sm:inline ${t.textMuted}`}
          >
            <span
              key={wordmarkPhase}
              className="animate-in fade-in duration-700"
            >
              {showGreetingPhase ? (
                <>
                  <span aria-hidden className="mr-1">
                    {greeting.emoji}
                  </span>
                  {greeting.text}, {firstName}
                </>
              ) : (
                <span className="tracking-[0.25em] uppercase">
                  Verbivore · Task Handoff
                </span>
              )}
            </span>
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
                  className={`hidden text-[9px] tracking-[0.22em] uppercase sm:inline ${t.textSubtle}`}
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
                      className={`ring-background flex size-4.5 items-center justify-center rounded-full text-[9px] font-semibold ring-1 ${t.surfaceMuted} ${t.text}`}
                    >
                      +{assigneeFilter.length - 3}
                    </span>
                  )}
                </div>
                {assigneeFilter.length === 1 && (
                  <span
                    className={`hidden max-w-30 truncate sm:inline ${t.text}`}
                  >
                    {team.find((m) => m.id === assigneeFilter[0])?.name ??
                      'unknown'}
                  </span>
                )}
                <X className={`size-3 ${t.textSubtle}`} />
              </button>
            )}
            <CurrentUserMenu user={currentUser} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="hidden min-h-0 w-56 shrink-0 md:block">
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
              onboardingComplete={initial.currentMember.onboardingComplete}
            />
          </div>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent
              side="left"
              aria-describedby={undefined}
              className="w-64 max-w-[80vw] gap-0 p-0 md:hidden"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
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
                onView={(v) => {
                  setView(v)
                  setMobileNavOpen(false)
                }}
                statusFilter={statusFilter}
                onToggleStatus={toggleStatus}
                onClearStatus={() => setStatusFilter([])}
                assigneeFilter={assigneeFilter}
                onToggleAssignee={toggleAssignee}
                onClearAssignee={() => setAssigneeFilter([])}
                counts={counts}
                secondary={view}
                onSecondary={(v) => {
                  setView(v)
                  setMobileNavOpen(false)
                }}
                showHints={showHints}
                currentUserId={currentUserId}
                onboardingComplete={initial.currentMember.onboardingComplete}
              />
            </SheetContent>
          </Sheet>

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
              totals={totals}
              onNewTask={() => openNewTask()}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              filterOpen={filterOpen}
              groupBy={groupBy}
              onGroupBy={(g) => {
                setGroupBy(g)
                setGroupOpen(false)
                // Group only changes anything on the Board. Bounce the
                // user there so the choice is immediately visible.
                if (tab !== 'board') {
                  const qs = currentSearchParams.toString()
                  router.push(
                    qs ? `/dashboard/board?${qs}` : '/dashboard/board'
                  )
                }
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
                    sprints
                  })}
                />
              }
              onOpenMobileNav={() => setMobileNavOpen(true)}
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
              allSprints={sprints
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
                          const currentSprint =
                            sprints.find(
                              (c) =>
                                c.projectId === initial.currentProjectId &&
                                c.status === 'current'
                            ) ?? null
                          return (
                            <SprintHero
                              sprint={currentSprint}
                              canEdit={
                                initial.currentMember.accessTier === 'admin' ||
                                initial.currentMember.accessTier === 'lead'
                              }
                              onPlan={() => setTab('sprints')}
                              onEdit={() => setTab('sprints')}
                              copySlot={
                                currentSprint ? (
                                  <CopyButton
                                    primaryLabel="Copy sprint"
                                    primaryToastLabel={`sprint ${currentSprint.name} as Markdown`}
                                    primaryGetContent={() =>
                                      sprintToMarkdown(currentSprint, exportCtx)
                                    }
                                    menu={[
                                      {
                                        id: 'md-full',
                                        label: 'Copy as Markdown',
                                        getContent: () =>
                                          sprintToMarkdown(
                                            currentSprint,
                                            exportCtx
                                          ),
                                        toastLabel: `sprint ${currentSprint.name} as Markdown`
                                      },
                                      {
                                        id: 'md-slim',
                                        label: 'Copy as Markdown (no comments)',
                                        getContent: () =>
                                          sprintToMarkdown(
                                            currentSprint,
                                            exportCtx,
                                            {
                                              withoutCommentsAndActivity: true
                                            }
                                          ),
                                        toastLabel: `sprint ${currentSprint.name} as Markdown`
                                      },
                                      {
                                        id: 'json-full',
                                        label: 'Copy as JSON',
                                        getContent: () =>
                                          sprintToJson(
                                            currentSprint,
                                            exportCtx
                                          ),
                                        toastLabel: `sprint ${currentSprint.name} as JSON`
                                      },
                                      {
                                        id: 'json-slim',
                                        label: 'Copy as JSON (no comments)',
                                        getContent: () =>
                                          sprintToJson(
                                            currentSprint,
                                            exportCtx,
                                            {
                                              withoutCommentsAndActivity: true
                                            }
                                          ),
                                        toastLabel: `sprint ${currentSprint.name} as JSON`
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
                        <div className="flex min-h-0 flex-1 scrollbar-none gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                                onAdd={() => {
                                  if (groupBy === 'status') {
                                    openNewTask(g.key as TaskStatus)
                                  } else if (groupBy === 'priority') {
                                    openNewTaskWith({
                                      priority: g.key as TaskPriority
                                    })
                                  } else {
                                    openNewTaskWith({
                                      assigneeId:
                                        g.key === 'unassigned' ? null : g.key
                                    })
                                  }
                                }}
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
                                    <TaskCard
                                      task={t}
                                      draggable={false}
                                      density={density}
                                    />
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
                  {tab === 'sprints' && initial.currentProjectId && (
                    <SprintsPanel
                      projectId={initial.currentProjectId}
                      sprints={sprints.filter(
                        (c) => c.projectId === initial.currentProjectId
                      )}
                      setSprints={setSprints}
                      tasks={tasks.filter(
                        (t) => t.projectId === initial.currentProjectId
                      )}
                      accessTier={initial.currentMember.accessTier}
                      onOpenTask={setSelectedId}
                      renderSprintCopySlot={(sprintId) => {
                        const c = sprints.find((x) => x.id === sprintId)
                        if (!c) return null
                        return (
                          <CopyButton
                            primaryLabel=""
                            iconOnly
                            primaryToastLabel={`sprint ${c.name} as Markdown`}
                            primaryGetContent={() =>
                              sprintToMarkdown(c, exportCtx)
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
                  allMembers={team}
                  onOpenProject={onOpenProject}
                  refsByProject={projectExternalRefs}
                  onAddProjectRef={addProjectExternalRef}
                  onRemoveProjectRef={removeProjectExternalRef}
                  onRenameProjectRef={renameProjectExternalRef}
                  renderCopySlot={(projectId) => {
                    const project = initial.projects.find(
                      (p) => p.id === projectId
                    )
                    if (!project) return null
                    return (
                      <CopyButton
                        primaryLabel=""
                        iconOnly
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
                  sprints={sprints}
                  refsByTask={externalRefs}
                  refsByProject={projectExternalRefs}
                  onFilterByStatus={(status) => {
                    const params = new URLSearchParams(
                      currentSearchParams.toString()
                    )
                    params.set('status', status)
                    params.delete('priority')
                    params.delete('feed')
                    const qs = params.toString()
                    router.push(
                      qs ? `/dashboard/board?${qs}` : '/dashboard/board'
                    )
                  }}
                  onFilterByPriority={(priority) => {
                    const params = new URLSearchParams(
                      currentSearchParams.toString()
                    )
                    params.set('priority', priority)
                    params.delete('status')
                    params.delete('feed')
                    const qs = params.toString()
                    router.push(
                      qs ? `/dashboard/board?${qs}` : '/dashboard/board'
                    )
                  }}
                />
              )}
              {view === 'archive' && (
                <ArchivePanel
                  sprints={sprints}
                  tasks={visibleTasks}
                  comments={comments}
                  activity={activity}
                  currentUserId={currentUserId}
                  accessTier={initial.currentMember.accessTier}
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
                  showHints={showHints}
                  setShowHints={setShowHints}
                  onboardingComplete={initial.currentMember.onboardingComplete}
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
                aria-describedby={undefined}
                className={`w-full p-0 sm:max-w-160! ${t.detail}`}
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
                    accessTier={initial.currentMember.accessTier}
                    onClose={() => setSelectedId(null)}
                    onChangeStatus={updateStatus}
                    onChangePriority={updatePriority}
                    onChangeAssignee={updateAssignee}
                    onChangeLead={updateLead}
                    onChangeDueDate={updateDueDate}
                    onChangeTitle={updateTitle}
                    onChangeDescription={updateDescription}
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
          defaultAssigneeId={newTaskAssigneeId}
          defaultPriority={newTaskPriority}
          members={team}
          labels={initial.labels}
          projects={initial.allActiveProjects}
          defaultProjectId={
            initial.currentProjectId ?? initial.defaultProjectId
          }
          // Pre-fill due date with the active sprint's end so tasks created
          // inside a running sprint inherit its deadline. Prefer the
          // 'current' sprint; fall back to the soonest 'upcoming' one;
          // otherwise no default. Scoped to the project the modal will
          // create into.
          defaultDueDate={(() => {
            const targetProjectId =
              initial.currentProjectId ?? initial.defaultProjectId
            if (!targetProjectId) return null
            const projectSprints = sprints.filter(
              (s) => s.projectId === targetProjectId
            )
            const current = projectSprints.find((s) => s.status === 'current')
            if (current) return current.toIso
            const upcoming = projectSprints
              .filter((s) => s.status === 'upcoming')
              .sort((a, b) => a.fromIso.localeCompare(b.fromIso))[0]
            return upcoming?.toIso ?? null
          })()}
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

function CurrentUserMenu({ user }: { user: BoardAssignee }) {
  const isAdmin = user.role === 'admin'
  const isLead = user.role === 'lead'
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

  const roleLabel = isAdmin ? 'Admin' : isLead ? 'Lead' : 'Member'

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
              : isLead
                ? 'bg-amber-500/15 text-amber-500'
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
