'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  Filter,
  Plus,
  Search,
  SlidersHorizontal
} from 'lucide-react'
import { AnimatedThemeToggler, useDashTheme } from './theme'
import type { GroupBy } from './DashboardShell'

export type QuickFilter = 'open' | 'due' | 'review' | 'done'

interface TopbarProps {
  query: string
  onQuery: (q: string) => void
  tab: 'board' | 'list' | 'timeline' | 'cycles'
  onTab: (t: 'board' | 'list' | 'timeline' | 'cycles') => void
  totals: { open: number; due: number; review: number; done: number }
  onNewTask: () => void
  onToggleFilter: () => void
  filterOpen: boolean
  groupBy: GroupBy
  onGroupBy: (g: GroupBy) => void
  groupOpen: boolean
  onToggleGroup: () => void
  projects: { id: string; name: string }[]
  currentProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  activeQuickFilter: QuickFilter | null
  onQuickFilter: (kind: QuickFilter) => void
  // Slot for the Copy view button. Lives next to "New task" on the right.
  // The parent (DashboardShell) owns the data, so the slot is a plain
  // ReactNode rather than a callback bag.
  copySlot?: React.ReactNode
}

const TABS: {
  id: 'board' | 'list' | 'timeline' | 'cycles'
  label: string
  requiresProject?: boolean
}[] = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'cycles', label: 'Cycles', requiresProject: true }
]

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' }
]

export default function Topbar({
  query,
  onQuery,
  tab,
  onTab,
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
  copySlot
}: TopbarProps) {
  const { t } = useDashTheme()
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId) ?? null
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

  return (
    <header
      className={`flex items-center justify-between gap-4 border-b px-4 h-12 shrink-0 ${t.topbar}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`flex items-center gap-1.5 text-xs ${t.textMuted}`}>
          <Link
            href="/dashboard"
            className={`${t.textSubtle} hover:opacity-80 transition`}
          >
            Verbivore
          </Link>
          <span className={t.textFaint}>/</span>
          <div className="relative" ref={projectMenuRef}>
            <button
              onClick={() => setProjectMenuOpen((o) => !o)}
              className={`flex items-center gap-1 ${t.text} hover:opacity-80 transition`}
              title="Switch project"
              aria-haspopup="menu"
              aria-expanded={projectMenuOpen}
            >
              <span className="truncate max-w-[180px]">
                {currentProject?.name ?? 'All tasks'}
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
                className={`absolute left-0 top-7 z-40 w-60 rounded-md border shadow-xl py-1 max-h-72 overflow-auto ${t.detail}`}
              >
                <button
                  onClick={() => {
                    onProjectChange(null)
                    setProjectMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs ${
                    currentProjectId === null ? t.btnActive : t.tab
                  }`}
                >
                  All tasks
                </button>
                <div className={`my-1 border-t ${t.borderSoft}`} />
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onProjectChange(p.id)
                      setProjectMenuOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs truncate ${
                      p.id === currentProjectId ? t.btnActive : t.tab
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`hidden md:flex items-center gap-1 rounded-md border p-0.5 ${t.border}`}
        >
          {TABS.map((opt) => {
            const disabled =
              opt.requiresProject && currentProjectId === null
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (disabled) return
                  onTab(opt.id)
                }}
                disabled={disabled}
                title={
                  disabled
                    ? 'Pick a project from the breadcrumb to plan cycles'
                    : undefined
                }
                className={`px-2.5 py-1 rounded text-xs transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  tab === opt.id ? t.tabActive : t.tab
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1 mr-1 md:mr-2">
          <StatButton
            kind="open"
            label="Open"
            value={totals.open}
            active={activeQuickFilter === 'open'}
            onClick={() => onQuickFilter('open')}
          />
          <StatButton
            kind="due"
            label="Due"
            value={totals.due}
            accent
            active={activeQuickFilter === 'due'}
            onClick={() => onQuickFilter('due')}
          />
          <StatButton
            kind="review"
            label="Review"
            value={totals.review}
            active={activeQuickFilter === 'review'}
            onClick={() => onQuickFilter('review')}
          />
          <StatButton
            kind="done"
            label="Done"
            value={totals.done}
            active={activeQuickFilter === 'done'}
            onClick={() => onQuickFilter('done')}
          />
        </div>

        <label className="relative hidden sm:flex items-center">
          <Search className={`size-3.5 absolute left-2.5 ${t.textSubtle}`} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search tasks…"
            className={`h-8 w-44 lg:w-60 rounded-md border pl-7 pr-2 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition ${t.input}`}
          />
        </label>

        <button
          onClick={onToggleFilter}
          className={`h-8 px-2.5 rounded-md border text-xs flex items-center gap-1.5 transition ${
            filterOpen ? t.btnActive : t.btn
          }`}
        >
          <Filter className="size-3.5" />
          Filter
        </button>

        <div className="relative">
          <button
            onClick={onToggleGroup}
            className={`h-8 px-2.5 rounded-md border text-xs flex items-center gap-1.5 transition ${
              groupOpen ? t.btnActive : t.btn
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            Group: {GROUPS.find((g) => g.id === groupBy)?.label}
          </button>
          {groupOpen && (
            <div
              className={`absolute right-0 top-9 z-40 w-40 rounded-md border shadow-xl py-1 ${t.detail}`}
            >
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onGroupBy(g.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs ${
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
          className={`h-8 w-8 rounded-md border flex items-center justify-center transition ${t.btn}`}
        />

        {copySlot}

        <button
          onClick={onNewTask}
          className={`h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition ${t.accent}`}
        >
          <Plus className="size-3.5" />
          New task
        </button>
      </div>
    </header>
  )
}

function StatButton({
  kind,
  label,
  value,
  accent,
  active,
  onClick
}: {
  kind: QuickFilter
  label: string
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
      title={`${label}: ${value}${active ? ' (active — click to clear)' : ''}`}
      className={`h-8 px-2 rounded-md border text-[11px] inline-flex items-center gap-1.5 transition ${
        active ? t.btnActive : t.btn
      }`}
      data-kind={kind}
    >
      <span
        className={`tabular-nums font-medium ${accent ? t.accentText : t.text}`}
      >
        {value}
      </span>
      <span
        className={`hidden md:inline uppercase tracking-wider text-[10px] ${t.textSubtle}`}
      >
        {label}
      </span>
    </button>
  )
}
