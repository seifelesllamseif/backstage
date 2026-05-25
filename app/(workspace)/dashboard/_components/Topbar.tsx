'use client'

import {
  Search,
  Filter,
  Plus,
  SlidersHorizontal,
  Sun,
  Moon
} from 'lucide-react'
import { useDashTheme } from './theme'
import type { GroupBy } from './DashboardShell'

interface TopbarProps {
  query: string
  onQuery: (q: string) => void
  tab: 'board' | 'list' | 'timeline'
  onTab: (t: 'board' | 'list' | 'timeline') => void
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
}

const TABS: { id: 'board' | 'list' | 'timeline'; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'timeline', label: 'Timeline' }
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
  onProjectChange
}: TopbarProps) {
  const { t, mode, toggle } = useDashTheme()
  return (
    <header
      className={`flex items-center justify-between gap-4 border-b px-4 h-12 shrink-0 ${t.topbar}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
          <span className={t.textSubtle}>Workspace</span>
          <span className={t.textFaint}>/</span>
          <span className={t.text}>Tasks</span>
        </div>

        <select
          value={currentProjectId ?? ''}
          onChange={(e) =>
            onProjectChange(e.target.value ? e.target.value : null)
          }
          className={`hidden md:inline-block h-8 rounded-md border px-2 text-xs focus:outline-none transition ${t.input}`}
          title="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div
          className={`hidden md:flex items-center gap-1 rounded-md border p-0.5 ${t.border}`}
        >
          {TABS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onTab(opt.id)}
              className={`px-2.5 py-1 rounded text-xs transition ${
                tab === opt.id ? t.tabActive : t.tab
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`hidden lg:flex items-center gap-4 mr-2 text-[11px] ${t.textMuted}`}
        >
          <Stat label="Open" value={totals.open} />
          <Stat label="Due" value={totals.due} accent />
          <Stat label="Review" value={totals.review} />
          <Stat label="Done" value={totals.done} />
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

        <button
          onClick={toggle}
          className={`h-8 w-8 rounded-md border flex items-center justify-center transition ${t.btn}`}
          title={mode === 'light' ? 'Switch to dark' : 'Switch to light'}
        >
          {mode === 'light' ? (
            <Moon className="size-3.5" />
          ) : (
            <Sun className="size-3.5" />
          )}
        </button>

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

function Stat({
  label,
  value,
  accent
}: {
  label: string
  value: number
  accent?: boolean
}) {
  const { t } = useDashTheme()
  return (
    <span className="inline-flex items-baseline gap-1">
      <span
        className={`tabular-nums font-medium ${accent ? t.accentText : t.text}`}
      >
        {value}
      </span>
      <span className={`uppercase tracking-wider text-[10px] ${t.textSubtle}`}>
        {label}
      </span>
    </span>
  )
}
