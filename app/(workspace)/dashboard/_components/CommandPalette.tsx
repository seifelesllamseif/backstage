'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  Folder,
  LayoutGrid,
  List as ListIcon,
  Rocket,
  Search,
  Settings as SettingsIcon,
  CheckSquare,
  ChartGantt
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useDashTheme } from './theme'
import { STATUS_BY_ID, type TaskStatus } from './status'
import StatusIcon from './StatusIcon'
import Avatar from './Avatar'
import type { BoardTask, BoardAssignee } from './boardData'
import { listMyMeetingRequests, listPendingApprovals } from '../actions'

type Tab = 'board' | 'list' | 'timeline' | 'sprints' | 'meetings'
type Secondary = 'settings' | 'updates' | 'symbols' | 'projects' | 'archive'

type NavItem =
  | { kind: 'tab'; id: Tab; label: string; icon: React.ReactNode }
  | { kind: 'view'; id: Secondary; label: string; icon: React.ReactNode }

interface Props {
  open: boolean
  onClose: () => void
  tasks: BoardTask[]
  projects: { id: string; name: string }[]
  currentProjectId: string | null
  members: BoardAssignee[]
  currentUserId: string
  currentUserAccessTier: 'admin' | 'lead' | 'member'
  currentUserWatcherTaskIds: string[]
  // Task ids in the currently-running sprint(s). Empty when no sprint
  // is active; drives the "Active sprint" filter chip.
  activeSprintTaskIds: string[]
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string | null) => void
  onSelectTab: (tab: Tab) => void
  onSelectView: (view: Secondary) => void
  onSelectMember: (memberId: string) => void
  // Opens the meetings sheet focused on the given request id. Wired
  // from DashboardShell via useMeetingsSheet().
  onSelectMeeting: (meetingId: string) => void
}

interface Row {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  group: 'Tasks' | 'Projects' | 'Navigation' | 'Members' | 'Meetings'
  onSelect: () => void
}

type Scope =
  | 'default'
  | 'tasks'
  | 'mine'
  | 'projects'
  | 'members'
  | 'meetings'
  | 'nav'

function parseQuery(raw: string): { scope: Scope; term: string } {
  const trimmed = raw.trimStart()
  // `>>` is parsed before `>` so the doubled form wins.
  if (trimmed.startsWith('>>')) return { scope: 'mine', term: trimmed.slice(2).trim() }
  if (trimmed.startsWith('>')) return { scope: 'tasks', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('@')) return { scope: 'members', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('#')) return { scope: 'projects', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('?')) return { scope: 'meetings', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('/')) return { scope: 'nav', term: trimmed.slice(1).trim() }
  return { scope: 'default', term: trimmed.trim() }
}

const SCOPE_LABEL: Record<Scope, string> = {
  default: '',
  tasks: 'Tasks',
  mine: 'My Tasks',
  projects: 'Projects',
  members: 'Members',
  meetings: 'Meetings',
  nav: 'Navigation'
}

const NAV: NavItem[] = [
  { kind: 'tab', id: 'board', label: 'Board', icon: <LayoutGrid className="size-3.5" /> },
  { kind: 'tab', id: 'list', label: 'List', icon: <ListIcon className="size-3.5" /> },
  { kind: 'tab', id: 'timeline', label: 'Timeline', icon: <ChartGantt className="size-3.5" /> },
  { kind: 'tab', id: 'sprints', label: 'Sprints', icon: <Rocket className="size-3.5" /> },
  { kind: 'tab', id: 'meetings', label: 'Calendar', icon: <CalendarDays className="size-3.5" /> },
  { kind: 'view', id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-3.5" /> },
  { kind: 'view', id: 'updates', label: 'Updates', icon: <CheckSquare className="size-3.5" /> },
  { kind: 'view', id: 'projects', label: 'Projects', icon: <Folder className="size-3.5" /> }
]

export default function CommandPalette({
  open,
  onClose,
  tasks,
  projects,
  currentProjectId,
  members,
  currentUserId,
  currentUserAccessTier,
  currentUserWatcherTaskIds,
  activeSprintTaskIds,
  onSelectTask,
  onSelectProject,
  onSelectTab,
  onSelectView,
  onSelectMember,
  onSelectMeeting
}: Props) {
  const { t, mode } = useDashTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // Filter chips that narrow task results without typing. Reset every
  // time the palette opens so the previous session's toggles don't leak.
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyCurrentProject, setOnlyCurrentProject] = useState(false)
  const [onlyActiveSprint, setOnlyActiveSprint] = useState(false)
  const [onlyDueSoon, setOnlyDueSoon] = useState(false)
  const [onlyWatching, setOnlyWatching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      const target = returnFocusRef.current
      returnFocusRef.current = null
      if (target && document.contains(target)) target.focus()
      return
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setQuery('')
    setActive(0)
    setOnlyMine(false)
    setOnlyCurrentProject(false)
    setOnlyActiveSprint(false)
    setOnlyDueSoon(false)
    setOnlyWatching(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const currentProjectName =
    projects.find((p) => p.id === currentProjectId)?.name ?? null

  // Shares query keys with MeetingsPanel so the palette gets cached data
  // for free when the panel is mounted. `enabled: open` keeps idle
  // palettes from polling. listPendingApprovals is admin/lead-only.
  const seesAllTasksLocal =
    currentUserAccessTier === 'admin' || currentUserAccessTier === 'lead'
  const myMeetingsQ = useQuery({
    queryKey: ['meetingRequests', 'mine'],
    queryFn: async () => {
      const res = await listMyMeetingRequests()
      if ('error' in res) return []
      return res.requests
    },
    enabled: open
  })
  const pendingMeetingsQ = useQuery({
    queryKey: ['meetingRequests', 'pending'],
    queryFn: async () => {
      const res = await listPendingApprovals()
      if ('error' in res) return []
      return res.requests
    },
    enabled: open && seesAllTasksLocal
  })
  const allMeetings = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; title: string; status: string; startsAt: string | null }
    >()
    const push = (
      r: { id: string; title: string; status: string; selectedStartsAt: string | null }
    ) => {
      if (
        r.status === 'canceled' ||
        r.status === 'rejected' ||
        r.status === 'declined'
      )
        return
      if (!byId.has(r.id)) {
        byId.set(r.id, {
          id: r.id,
          title: r.title,
          status: r.status,
          startsAt: r.selectedStartsAt
        })
      }
    }
    for (const r of myMeetingsQ.data ?? []) push(r)
    for (const r of pendingMeetingsQ.data ?? []) push(r)
    return [...byId.values()].sort((a, b) => {
      const aT = a.startsAt ? Date.parse(a.startsAt) : 0
      const bT = b.startsAt ? Date.parse(b.startsAt) : 0
      return bT - aT
    })
  }, [myMeetingsQ.data, pendingMeetingsQ.data])

  const seesAllTasks =
    currentUserAccessTier === 'admin' || currentUserAccessTier === 'lead'

  const { scope, term } = useMemo(() => {
    const parsed = parseQuery(query)
    // Members' visible task slice already overlaps heavily with "their"
    // tasks (the server scopes them to assignee + watcher), so the >>
    // distinction is noise. Collapse it to plain tasks for them.
    if (parsed.scope === 'mine' && !seesAllTasks) {
      return { scope: 'tasks' as const, term: parsed.term }
    }
    return parsed
  }, [query, seesAllTasks])

  const rows = useMemo<Row[]>(() => {
    const q = term.toLowerCase()
    const out: Row[] = []

    const pushProject = (
      id: string | null,
      label: string,
      isCurrent: boolean
    ) => {
      out.push({
        id: id ? `project:${id}` : 'project:null',
        label,
        hint: isCurrent ? 'Current' : undefined,
        icon: <Folder className="size-3.5" />,
        group: 'Projects',
        onSelect: () => onSelectProject(id)
      })
    }
    const pushNav = (n: NavItem) => {
      out.push({
        id: `nav:${n.id}`,
        label: n.label,
        icon: n.icon,
        group: 'Navigation',
        onSelect: () =>
          n.kind === 'tab' ? onSelectTab(n.id) : onSelectView(n.id)
      })
    }
    const pushMember = (m: BoardAssignee) => {
      out.push({
        id: `member:${m.id}`,
        label: m.name,
        hint: m.id === currentUserId ? 'You' : undefined,
        icon: <Avatar user={m} size={20} showPresence={false} />,
        group: 'Members',
        onSelect: () => onSelectMember(m.id)
      })
    }
    const pushTask = (task: BoardTask) => {
      const statusLabel =
        STATUS_BY_ID[task.status as TaskStatus]?.label ?? task.status
      out.push({
        id: `task:${task.id}`,
        label: task.title,
        hint: `${task.ref} . ${statusLabel}`,
        icon: <StatusIcon status={task.status} className="size-3.5" />,
        group: 'Tasks',
        onSelect: () => onSelectTask(task.id)
      })
    }
    const pushMeeting = (m: {
      id: string
      title: string
      status: string
      startsAt: string | null
    }) => {
      const when = m.startsAt
        ? new Date(m.startsAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        : 'Unscheduled'
      out.push({
        id: `meeting:${m.id}`,
        label: m.title,
        hint: `${when} . ${m.status}`,
        icon: <CalendarDays className="size-3.5" />,
        group: 'Meetings',
        onSelect: () => onSelectMeeting(m.id)
      })
    }

    const orderedMembers = [
      ...members.filter((m) => m.id === currentUserId),
      ...members.filter(
        (m) => m.id !== currentUserId && m.activityStatus !== 'left'
      )
    ]
    // Members are scoped server-side to assignee + watcher; mirror that here
    // so search can never widen the visible task set, even if the server
    // query later regresses. Admins/leads see every company task.
    const watcherSet = new Set(currentUserWatcherTaskIds)
    const roleScopedTasks = seesAllTasks
      ? tasks
      : tasks.filter(
          (task) =>
            task.assignee?.id === currentUserId || watcherSet.has(task.id)
        )
    const activeSprintSet = new Set(activeSprintTaskIds)
    // "Due soon" = task has a due date that is either past or within 7
    // days from now. Computed at filter time so it stays accurate across
    // long-lived palette sessions.
    const dueSoonCutoff = Date.now() + 7 * 24 * 60 * 60 * 1000
    const scopedTasks = roleScopedTasks.filter((task) => {
      if (onlyMine && task.assignee?.id !== currentUserId) return false
      if (
        onlyCurrentProject &&
        currentProjectId &&
        task.projectId !== currentProjectId
      )
        return false
      if (onlyActiveSprint && !activeSprintSet.has(task.id)) return false
      if (onlyDueSoon) {
        if (!task.dueAt) return false
        if (Date.parse(task.dueAt) > dueSoonCutoff) return false
      }
      if (onlyWatching) {
        if (!watcherSet.has(task.id)) return false
        if (task.assignee?.id === currentUserId) return false
      }
      return true
    })
    const recentTasks = [...scopedTasks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    const myTasks = recentTasks.filter(
      (task) => task.assignee?.id === currentUserId
    )

    if (scope === 'tasks') {
      const list = q
        ? recentTasks.filter((t) => {
            const hay = `${t.ref} ${t.title} ${t.description ?? ''}`.toLowerCase()
            return hay.includes(q)
          })
        : recentTasks
      const cap = q ? 30 : 15
      list.slice(0, cap).forEach(pushTask)
      return out
    }

    if (scope === 'mine') {
      const list = q
        ? myTasks.filter((t) => {
            const hay = `${t.ref} ${t.title} ${t.description ?? ''}`.toLowerCase()
            return hay.includes(q)
          })
        : myTasks
      const cap = q ? 30 : 15
      list.slice(0, cap).forEach(pushTask)
      return out
    }

    if (scope === 'projects') {
      if (!q || 'all projects'.includes(q)) {
        pushProject(null, 'All Projects', currentProjectId === null)
      }
      for (const p of projects) {
        if (!q || p.name.toLowerCase().includes(q)) {
          pushProject(p.id, p.name, p.id === currentProjectId)
        }
      }
      return out
    }

    if (scope === 'members') {
      for (const m of orderedMembers) {
        if (!q || m.name.toLowerCase().includes(q)) pushMember(m)
      }
      return out
    }

    if (scope === 'nav') {
      for (const n of NAV) {
        if (!q || n.label.toLowerCase().includes(q)) pushNav(n)
      }
      return out
    }

    if (scope === 'meetings') {
      const list = q
        ? allMeetings.filter((m) => m.title.toLowerCase().includes(q))
        : allMeetings
      list.slice(0, q ? 30 : 15).forEach(pushMeeting)
      return out
    }

    // Default scope: empty input shows nav only; typing fans out across
    // every category (projects, nav, members, then up to 30 tasks).
    //
    // When a chip is on the user has asked for a task view, so swap nav
    // for the filtered task list so toggling the chip is never a no-op.
    const hasChipFilter =
      onlyMine ||
      onlyCurrentProject ||
      onlyActiveSprint ||
      onlyDueSoon ||
      onlyWatching
    if (!q) {
      if (hasChipFilter) {
        recentTasks.slice(0, 15).forEach(pushTask)
      } else {
        for (const n of NAV) pushNav(n)
      }
      return out
    }
    if ('all projects'.includes(q)) {
      pushProject(null, 'All Projects', currentProjectId === null)
    }
    for (const p of projects) {
      if (p.name.toLowerCase().includes(q)) {
        pushProject(p.id, p.name, p.id === currentProjectId)
      }
    }
    for (const n of NAV) {
      if (n.label.toLowerCase().includes(q)) pushNav(n)
    }
    for (const m of orderedMembers) {
      if (m.name.toLowerCase().includes(q)) pushMember(m)
    }
    let taskCount = 0
    for (const task of recentTasks) {
      if (taskCount >= 30) break
      const hay = `${task.ref} ${task.title} ${
        task.description ?? ''
      }`.toLowerCase()
      if (hay.includes(q)) {
        pushTask(task)
        taskCount++
      }
    }
    let meetingCount = 0
    for (const m of allMeetings) {
      if (meetingCount >= 10) break
      if (m.title.toLowerCase().includes(q)) {
        pushMeeting(m)
        meetingCount++
      }
    }
    return out
  }, [
    scope,
    term,
    tasks,
    projects,
    currentProjectId,
    members,
    currentUserId,
    seesAllTasks,
    currentUserWatcherTaskIds,
    activeSprintTaskIds,
    allMeetings,
    onlyMine,
    onlyCurrentProject,
    onlyActiveSprint,
    onlyDueSoon,
    onlyWatching,
    onSelectTask,
    onSelectProject,
    onSelectTab,
    onSelectView,
    onSelectMember,
    onSelectMeeting
  ])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault()
        setActive((i) => Math.min(rows.length - 1, i + 1))
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const row = rows[active]
        if (row) {
          row.onSelect()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, rows, active, onClose])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${active}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const surface =
    mode === 'light'
      ? 'bg-white border-zinc-200'
      : 'bg-zinc-950 border-white/10'

  const grouped: { group: Row['group']; rows: { row: Row; idx: number }[] }[] = []
  rows.forEach((row, idx) => {
    let bucket = grouped.find((g) => g.group === row.group)
    if (!bucket) {
      bucket = { group: row.group, rows: [] }
      grouped.push(bucket)
    }
    bucket.rows.push({ row, idx })
  })

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl ${surface}`}
      >
        <div className={`flex items-center gap-2 border-b px-3 ${t.borderSoft}`}>
          <Search className={`size-4 ${t.textSubtle}`} />
          {scope !== 'default' && (
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase ${t.borderSoft} ${t.textMuted}`}
            >
              {SCOPE_LABEL[scope]}
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              scope === 'default'
                ? 'Type a command or search…'
                : `Search ${SCOPE_LABEL[scope].toLowerCase()}…`
            }
            aria-label="Search and navigate"
            className={`h-11 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 ${t.text}`}
          />
          <kbd
            className={`hidden rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase sm:inline ${t.borderSoft} ${t.textSubtle}`}
          >
            Esc
          </kbd>
        </div>

        {(scope === 'tasks' || scope === 'mine' || scope === 'default') && (
          <div
            className={`flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5 ${t.borderSoft}`}
          >
            <span className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}>
              Filter
            </span>
            <button
              type="button"
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                onlyMine
                  ? `${t.btnActive} ${t.borderSoft}`
                  : `${t.borderSoft} ${t.textMuted} hover:${t.text}`
              }`}
            >
              Assigned to me
            </button>
            {currentProjectName && (
              <button
                type="button"
                aria-pressed={onlyCurrentProject}
                onClick={() => setOnlyCurrentProject((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                  onlyCurrentProject
                    ? `${t.btnActive} ${t.borderSoft}`
                    : `${t.borderSoft} ${t.textMuted} hover:${t.text}`
                }`}
                title={`Limit to ${currentProjectName}`}
              >
                In {currentProjectName}
              </button>
            )}
            {activeSprintTaskIds.length > 0 && (
              <button
                type="button"
                aria-pressed={onlyActiveSprint}
                onClick={() => setOnlyActiveSprint((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                  onlyActiveSprint
                    ? `${t.btnActive} ${t.borderSoft}`
                    : `${t.borderSoft} ${t.textMuted} hover:${t.text}`
                }`}
                title="Only tasks in the current sprint"
              >
                Active sprint
              </button>
            )}
            <button
              type="button"
              aria-pressed={onlyDueSoon}
              onClick={() => setOnlyDueSoon((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                onlyDueSoon
                  ? `${t.btnActive} ${t.borderSoft}`
                  : `${t.borderSoft} ${t.textMuted} hover:${t.text}`
              }`}
              title="Due within 7 days or overdue"
            >
              Due soon
            </button>
            {currentUserWatcherTaskIds.length > 0 && (
              <button
                type="button"
                aria-pressed={onlyWatching}
                onClick={() => setOnlyWatching((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                  onlyWatching
                    ? `${t.btnActive} ${t.borderSoft}`
                    : `${t.borderSoft} ${t.textMuted} hover:${t.text}`
                }`}
                title="Tasks I watch but don't own"
              >
                Watching
              </button>
            )}
          </div>
        )}

        <div aria-live="polite" className="sr-only">
          {query.trim()
            ? `${rows.length} result${rows.length === 1 ? '' : 's'}`
            : ''}
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-1 [scrollbar-width:thin]"
        >
          {grouped.length === 0 ? (
            <div className={`px-4 py-6 text-center text-xs ${t.textSubtle}`}>
              No results.
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.group} className="py-1">
                <div
                  className={`px-3 pb-1 text-[10px] tracking-[0.22em] uppercase ${t.textSubtle}`}
                >
                  {group.group}
                </div>
                {group.rows.map(({ row, idx }) => {
                  const isActive = idx === active
                  return (
                    <button
                      key={row.id}
                      data-row-index={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => {
                        row.onSelect()
                        onClose()
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition ${
                        isActive ? t.btnActive : t.tab
                      }`}
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        {row.icon}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${t.text}`}>
                        {row.label}
                      </span>
                      {row.hint && (
                        <span className={`shrink-0 text-[10px] ${t.textSubtle}`}>
                          {row.hint}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div
          className={`flex items-center justify-between gap-3 border-t px-3 py-2 text-[10px] ${t.borderSoft} ${t.textSubtle}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              <kbd
                className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
              >
                &gt;
              </kbd>
              tasks
            </span>
            {seesAllTasks && (
              <span>
                <kbd
                  className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
                >
                  &gt;&gt;
                </kbd>
                my tasks
              </span>
            )}
            <span>
              <kbd
                className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
              >
                @
              </kbd>
              people
            </span>
            <span>
              <kbd
                className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
              >
                #
              </kbd>
              projects
            </span>
            <span>
              <kbd
                className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
              >
                ?
              </kbd>
              meetings
            </span>
            <span>
              <kbd
                className={`mr-0.5 rounded border px-1 py-0.5 ${t.borderSoft}`}
              >
                /
              </kbd>
              navigate
            </span>
          </div>
          <span className="shrink-0">
            <kbd className={`mr-1 rounded border px-1 py-0.5 ${t.borderSoft}`}>
              enter
            </kbd>
            open
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
