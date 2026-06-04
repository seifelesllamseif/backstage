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
import { useDashTheme } from './theme'
import { STATUS_BY_ID, type TaskStatus } from './status'
import StatusIcon from './StatusIcon'
import Avatar from './Avatar'
import type { BoardTask, BoardAssignee } from './boardData'

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
  onSelectTask: (taskId: string) => void
  onSelectProject: (projectId: string | null) => void
  onSelectTab: (tab: Tab) => void
  onSelectView: (view: Secondary) => void
  onSelectMember: (memberId: string) => void
}

interface Row {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  group: 'Tasks' | 'Projects' | 'Navigation' | 'Members'
  onSelect: () => void
}

type Scope = 'default' | 'tasks' | 'projects' | 'members' | 'nav'

function parseQuery(raw: string): { scope: Scope; term: string } {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('>')) return { scope: 'tasks', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('@')) return { scope: 'members', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('#')) return { scope: 'projects', term: trimmed.slice(1).trim() }
  if (trimmed.startsWith('/')) return { scope: 'nav', term: trimmed.slice(1).trim() }
  return { scope: 'default', term: trimmed.trim() }
}

const SCOPE_LABEL: Record<Scope, string> = {
  default: '',
  tasks: 'Tasks',
  projects: 'Projects',
  members: 'Members',
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
  onSelectTask,
  onSelectProject,
  onSelectTab,
  onSelectView,
  onSelectMember
}: Props) {
  const { t, mode } = useDashTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
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
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const { scope, term } = useMemo(() => parseQuery(query), [query])

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

    const orderedMembers = [
      ...members.filter((m) => m.id === currentUserId),
      ...members.filter(
        (m) => m.id !== currentUserId && m.activityStatus !== 'left'
      )
    ]
    const recentTasks = [...tasks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
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

    // Default scope: empty input shows nav only; typing fans out across
    // every category (projects, nav, members, then up to 30 tasks).
    if (!q) {
      for (const n of NAV) pushNav(n)
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
    return out
  }, [
    scope,
    term,
    tasks,
    projects,
    currentProjectId,
    members,
    currentUserId,
    onSelectTask,
    onSelectProject,
    onSelectTab,
    onSelectView,
    onSelectMember
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
