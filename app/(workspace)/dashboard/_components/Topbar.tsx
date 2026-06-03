'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Eye,
  Filter,
  Menu,
  Plus,
  Search,
  SlidersHorizontal
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatedThemeToggler, useDashTheme } from './theme'
import type { GroupBy } from './DashboardShell'

export type QuickFilter = 'open' | 'due' | 'review' | 'done'

interface TopbarProps {
  query: string
  onQuery: (q: string) => void
  tab: 'board' | 'list' | 'timeline' | 'sprints' | 'meetings'
  totals: { open: number; due: number; review: number; done: number }
  onNewTask: () => void
  onToggleFilter: () => void
  filterOpen: boolean
  // Number of selected values across status / priority / assignee / tag.
  // Rendered as a small badge on the Filter button so the user sees at a
  // glance how many filters are on without opening the panel.
  activeFilterCount: number
  groupBy: GroupBy
  onGroupBy: (g: GroupBy) => void
  groupOpen: boolean
  onToggleGroup: () => void
  projects: { id: string; name: string }[]
  currentProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  activeQuickFilter: QuickFilter | null
  onQuickFilter: (kind: QuickFilter) => void
  // Plain-language label for the current view, shown in the breadcrumb.
  // Computed by DashboardShell so all the cases (Projects / Updates /
  // Symbols / Settings / Archive) stay in one place.
  viewLabel: string
  // Quick-feed view selector. The breadcrumb dropdown surfaces the same
  // four shortcuts that live in the sidebar so users can hop between
  // them without leaving the topbar.
  feedView: 'all' | 'mine' | 'inbox' | 'mentions'
  onFeedViewChange: (v: 'all' | 'mine' | 'inbox' | 'mentions') => void
  // Slot for the Copy view button. Lives next to "New task" on the right.
  // The parent (DashboardShell) owns the data, so the slot is a plain
  // ReactNode rather than a callback bag.
  copySlot?: React.ReactNode
  // Mobile-only hamburger handler. When provided, renders a Menu button
  // at the start of the topbar visible at <md that toggles the Sidebar
  // sheet. Omit on desktop-only contexts.
  onOpenMobileNav?: () => void
}

const FEED_VIEWS: {
  id: 'all' | 'mine' | 'inbox' | 'mentions'
  label: string
}[] = [
  { id: 'all', label: 'All Tasks' },
  { id: 'mine', label: 'My Tasks' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'mentions', label: 'Mentions' }
]

const TABS: {
  id: 'board' | 'list' | 'timeline' | 'sprints' | 'meetings'
  label: string
  requiresProject?: boolean
}[] = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sprints', label: 'Sprints', requiresProject: true },
  { id: 'meetings', label: 'Calendar' }
]

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'lead', label: 'Lead' },
  { id: 'priority', label: 'Priority' }
]

export default function Topbar({
  query,
  onQuery,
  tab,
  totals,
  onNewTask,
  onToggleFilter,
  filterOpen,
  groupBy,
  onGroupBy,
  groupOpen,
  onToggleGroup,
  projects,
  currentProjectId,
  onProjectChange,
  activeQuickFilter,
  onQuickFilter,
  activeFilterCount,
  viewLabel,
  feedView,
  onFeedViewChange,
  copySlot,
  onOpenMobileNav
}: TopbarProps) {
  const { t } = useDashTheme()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const hrefFor = (tabId: string) =>
    qs ? `/dashboard/${tabId}?${qs}` : `/dashboard/${tabId}`
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const currentProject = currentProjectId
    ? (projects.find((p) => p.id === currentProjectId) ?? null)
    : null

  useEffect(() => {
    if (!projectMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!projectMenuRef.current?.contains(e.target as Node)) {
        setProjectMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [projectMenuOpen])

  useEffect(() => {
    if (!viewMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!viewMenuRef.current?.contains(e.target as Node)) {
        setViewMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [viewMenuOpen])

  return (
    <header
      className={`flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3 sm:gap-4 sm:px-4 ${t.topbar}`}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className={`-ml-1 flex size-7 items-center justify-center rounded-md md:hidden ${t.tab}`}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>
        )}
        <div
          className={`flex min-w-0 items-center gap-1.5 text-xs ${t.textMuted}`}
        >
          <Link
            href="/dashboard"
            className={`hidden sm:inline ${t.textSubtle} transition hover:opacity-80`}
          >
            Verbivore
          </Link>
          <span className={`hidden sm:inline ${t.textFaint}`}>/</span>
          <div className="relative min-w-0" ref={projectMenuRef}>
            <button
              data-tour="project-switcher"
              onClick={() => setProjectMenuOpen((o) => !o)}
              className={`flex items-center gap-1 ${t.text} transition hover:opacity-80`}
              title="Switch project"
              aria-haspopup="menu"
              aria-expanded={projectMenuOpen}
            >
              <span className="max-w-32 truncate sm:max-w-45">
                {currentProject?.name ?? 'All Projects'}
              </span>
              <ChevronDown
                className={`size-3 ${t.textSubtle} transition-transform ${
                  projectMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {projectMenuOpen && (
              <div
                role="menu"
                className={`absolute top-7 left-0 z-40 max-h-72 w-60 overflow-auto rounded-md border py-1 shadow-xl ${t.detail}`}
              >
                <button
                  onClick={() => {
                    onProjectChange(null)
                    setProjectMenuOpen(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs ${
                    currentProjectId === null ? t.btnActive : t.tab
                  }`}
                >
                  All Projects
                </button>
                <div className={`my-1 border-t ${t.borderSoft}`} />
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onProjectChange(p.id)
                      setProjectMenuOpen(false)
                    }}
                    className={`w-full truncate px-3 py-1.5 text-left text-xs ${
                      p.id === currentProjectId ? t.btnActive : t.tab
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={`hidden sm:inline ${t.textFaint}`}>/</span>
          <div className="relative hidden sm:block" ref={viewMenuRef}>
            <button
              onClick={() => setViewMenuOpen((o) => !o)}
              className={`flex items-center gap-1 ${t.text} transition hover:opacity-80`}
              title="Switch view"
              aria-haspopup="menu"
              aria-expanded={viewMenuOpen}
            >
              <span className="max-w-40 truncate">{viewLabel}</span>
              <ChevronDown
                className={`size-3 ${t.textSubtle} transition-transform ${
                  viewMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {viewMenuOpen && (
              <div
                role="menu"
                className={`absolute top-7 left-0 z-40 w-44 overflow-auto rounded-md border py-1 shadow-xl ${t.detail}`}
              >
                {FEED_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onFeedViewChange(v.id)
                      setViewMenuOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs ${
                      feedView === v.id ? t.btnActive : t.tab
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`hidden items-center gap-1 rounded-md border p-0.5 md:flex ${t.border}`}
        >
          {TABS.map((opt) => {
            const disabled = opt.requiresProject && currentProjectId === null
            const className = `rounded px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
              tab === opt.id ? t.tabActive : t.tab
            }`
            if (disabled) {
              return (
                <button
                  key={opt.id}
                  disabled
                  title="Pick a project from the breadcrumb to plan sprints"
                  className={className}
                >
                  {opt.label}
                </button>
              )
            }
            return (
              <Link
                key={opt.id}
                href={hrefFor(opt.id)}
                prefetch
                className={className}
              >
                {opt.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="mr-1 hidden items-center gap-1 md:mr-2 md:flex">
          <StatButton
            kind="open"
            label="Open"
            Icon={CircleDot}
            value={totals.open}
            active={activeQuickFilter === 'open'}
            onClick={() => onQuickFilter('open')}
          />
          <StatButton
            kind="due"
            label="Due"
            Icon={AlertTriangle}
            value={totals.due}
            accent
            active={activeQuickFilter === 'due'}
            onClick={() => onQuickFilter('due')}
          />
          <StatButton
            kind="review"
            label="Review"
            Icon={Eye}
            value={totals.review}
            active={activeQuickFilter === 'review'}
            onClick={() => onQuickFilter('review')}
          />
          <StatButton
            kind="done"
            label="Done"
            Icon={CheckCircle2}
            value={totals.done}
            active={activeQuickFilter === 'done'}
            onClick={() => onQuickFilter('done')}
          />
        </div>

        <label className="relative hidden items-center sm:flex">
          <Search className={`absolute left-2 size-3 ${t.textSubtle}`} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search…"
            className={`h-8 w-28 rounded-md border pr-2 pl-6 text-xs transition-[width,border-color] duration-500 ease-out focus:w-44 focus:border-zinc-400 focus:outline-none 2xl:w-44 2xl:focus:w-56 dark:focus:border-white/30 ${t.input}`}
          />
        </label>

        <button
          onClick={onToggleFilter}
          aria-label="Toggle filters"
          title={
            activeFilterCount > 0
              ? `Filters (${activeFilterCount} active)`
              : 'Filters'
          }
          className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition ${
            filterOpen || activeFilterCount > 0 ? t.btnActive : t.btn
          }`}
        >
          <Filter className="size-3.5" />
          <span className="hidden 2xl:inline">Filter</span>
          {activeFilterCount > 0 && (
            <span
              className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-semibold text-white`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="relative hidden md:block">
          <button
            onClick={onToggleGroup}
            aria-label="Group tasks"
            title={`Group: ${GROUPS.find((g) => g.id === groupBy)?.label}`}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition ${
              groupOpen ? t.btnActive : t.btn
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden 2xl:inline">
              Group: {GROUPS.find((g) => g.id === groupBy)?.label}
            </span>
            <span className={`inline 2xl:hidden ${t.textMuted}`}>
              {GROUPS.find((g) => g.id === groupBy)?.label.charAt(0)}
            </span>
          </button>
          {groupOpen && (
            <div
              className={`absolute top-9 right-0 z-40 w-40 rounded-md border py-1 shadow-xl ${t.detail}`}
            >
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onGroupBy(g.id)}
                  className={`w-full px-3 py-1.5 text-left text-xs ${
                    groupBy === g.id ? t.btnActive : `${t.tab}`
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <AnimatedThemeToggler
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${t.btn}`}
        />

        {copySlot}

        <button
          data-tour="new-task"
          onClick={onNewTask}
          aria-label="New task"
          title="New task"
          className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition ${t.accent}`}
        >
          <Plus className="size-3.5" />
          <span className="hidden 2xl:inline">New task</span>
        </button>
      </div>
    </header>
  )
}

function StatButton({
  kind,
  label,
  Icon,
  value,
  accent,
  active,
  onClick
}: {
  kind: QuickFilter
  label: string
  Icon: LucideIcon
  value: number
  accent?: boolean
  active: boolean
  onClick: () => void
}) {
  const { t } = useDashTheme()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${value}`}
      title={`${label}: ${value}${active ? ' (active, click to clear)' : ''}`}
      className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${
        active ? t.btnActive : t.btn
      }`}
      data-kind={kind}
    >
      <Icon className={`size-3.5 ${accent ? t.accentText : t.textMuted}`} />
      <span
        className={`font-medium tabular-nums ${accent ? t.accentText : t.text}`}
      >
        {value}
      </span>
      <span
        className={`hidden text-[10px] tracking-wider uppercase 2xl:inline ${t.textSubtle}`}
      >
        {label}
      </span>
    </button>
  )
}
