'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bell,
  Code2,
  Search,
  ChevronRight,
  Filter,
  Settings as SettingsIcon,
  List as ListIcon,
  Columns3
} from 'lucide-react'
import { BoardTask, Sprint } from './boardData'
import { useTeam } from './TeamContext'
import {
  PRIORITY_LABEL,
  RELATION_LABEL,
  STATUSES,
  STATUS_BY_ID,
  TaskStatus
} from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import Avatar from './Avatar'
import { useDashTheme } from './theme'
import TaskDetailContent, {
  TaskActivityLite,
  TaskCommentLite
} from './TaskDetailContent'
import { TaskPriority } from './status'

interface ArchivePanelProps {
  sprints: Sprint[]
  tasks: BoardTask[]
  comments: Record<string, TaskCommentLite[]>
  activity: Record<string, TaskActivityLite[]>
  onChangeStatus: (id: string, s: import('./status').TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
}

export default function ArchivePanel({
  sprints,
  tasks,
  comments,
  activity,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment
}: ArchivePanelProps) {
  const { t, mode } = useDashTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  const defaultActive =
    sprints.find((sprint) => sprint.status === 'current')?.id ?? sprints[0]?.id
  const [activeId, setActiveId] = useState<string | undefined>(defaultActive)
  const [query, setQuery] = useState('')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame = 0
    const handle = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect()
        const focus = containerRect.top + containerRect.height * 0.38
        const sections =
          container.querySelectorAll<HTMLElement>('[data-sprint-id]')
        let closest: { id: string; dist: number } | null = null
        sections.forEach((node) => {
          const rect = node.getBoundingClientRect()
          const center = rect.top + rect.height / 2
          const dist = Math.abs(center - focus)
          if (!closest || dist < closest.dist) {
            closest = { id: node.dataset.sprintId ?? '', dist }
          }
        })
        const c = closest as { id: string; dist: number } | null
        if (c && c.id) setActiveId(c.id)
      })
    }
    container.addEventListener('scroll', handle, { passive: true })
    handle()
    return () => {
      container.removeEventListener('scroll', handle)
      cancelAnimationFrame(frame)
    }
  }, [])

  const tasksById = useMemo(() => {
    const map = new Map<string, BoardTask>()
    tasks.forEach((task) => map.set(task.id, task))
    return map
  }, [tasks])

  const ordered = useMemo(() => {
    const completed = sprints.filter((c) => c.status === 'completed')
    const current = sprints.filter((c) => c.status === 'current')
    const upcoming = sprints.filter((c) => c.status === 'upcoming')
    return [...completed, ...current, ...upcoming]
  }, [sprints])

  const activeIndex = ordered.findIndex((c) => c.id === activeId)
  const jumpTo = (idx: number) => {
    const sprint = ordered[idx]
    if (!sprint) return
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-sprint-id="${sprint.id}"]`
    )
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const surface = mode === 'light' ? 'bg-zinc-50' : 'bg-zinc-950/60'
  const topbarBg = mode === 'light' ? 'bg-zinc-50/95' : 'bg-zinc-950/95'

  return (
    <div
      ref={containerRef}
      data-archive-scroll
      className={`h-full overflow-y-scroll ${surface}`}
      style={{ scrollbarGutter: 'stable' }}
    >
      <div
        className={`sticky top-0 z-20 flex h-12 items-center justify-between border-b px-4 backdrop-blur-sm ${topbarBg} ${t.border}`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => jumpTo(Math.max(0, activeIndex - 1))}
            className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
            aria-label="Previous sprint"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <button
            onClick={() =>
              jumpTo(Math.min(ordered.length - 1, activeIndex + 1))
            }
            className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
            aria-label="Next sprint"
          >
            <ArrowRight className="size-3.5" />
          </button>
          <div className={`ml-2 flex items-center gap-2 text-xs ${t.text}`}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${
                mode === 'light'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              <Code2 className="size-3.5" />
              Series
            </span>
            <ChevronRight className={`size-3 ${t.textSubtle}`} />
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${t.surfaceMuted}`}
            >
              Sprints
            </span>
            <span className={t.textSubtle}>· · ·</span>
          </div>
        </div>

        <label className="relative flex w-64 max-w-sm items-center">
          <Search className={`absolute left-2.5 size-3.5 ${t.textSubtle}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className={`h-8 w-full rounded-md border pr-2 pl-7 text-xs focus:outline-none ${t.input}`}
          />
        </label>

        <div className="flex items-center gap-1">
          <button
            onClick={() => jumpTo(Math.max(0, activeIndex - 1))}
            className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
            aria-label="Up"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={() =>
              jumpTo(Math.min(ordered.length - 1, activeIndex + 1))
            }
            className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
            aria-label="Down"
          >
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {ordered.map((sprint) => {
          const isFocused = sprint.id === activeId
          const sprintTasks = sprint.taskIds
            .map((id) => tasksById.get(id))
            .filter((task): task is BoardTask => Boolean(task))
            .filter((task) =>
              query.trim()
                ? task.title.toLowerCase().includes(query.toLowerCase()) ||
                  task.ref.toLowerCase().includes(query.toLowerCase())
                : true
            )
          return (
            <SprintSection
              key={sprint.id}
              sprint={sprint}
              tasks={sprintTasks}
              isFocused={isFocused}
              onSelect={() => setActiveId(sprint.id)}
              expandedTaskId={expandedTaskId}
              onToggleTask={(id) =>
                setExpandedTaskId((cur) => (cur === id ? null : id))
              }
              comments={comments}
              activity={activity}
              onChangeStatus={onChangeStatus}
              onChangePriority={onChangePriority}
              onChangeAssignee={onChangeAssignee}
              onAddComment={onAddComment}
            />
          )
        })}
        <div className="h-2 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

function SprintSection({
  sprint,
  tasks,
  isFocused,
  onSelect,
  expandedTaskId,
  onToggleTask,
  comments,
  activity,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment
}: {
  sprint: Sprint
  tasks: BoardTask[]
  isFocused: boolean
  onSelect: () => void
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  comments: Record<string, TaskCommentLite[]>
  activity: Record<string, TaskActivityLite[]>
  onChangeStatus: (id: string, s: import('./status').TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
}) {
  const { t, mode } = useDashTheme()

  const progressColor =
    sprint.status === 'completed'
      ? mode === 'light'
        ? 'bg-emerald-300'
        : 'bg-emerald-500/60'
      : sprint.status === 'current'
        ? mode === 'light'
          ? 'bg-amber-400'
          : 'bg-amber-500/70'
        : mode === 'light'
          ? 'bg-zinc-300'
          : 'bg-white/15'

  const trackBg =
    sprint.status === 'completed'
      ? mode === 'light'
        ? 'bg-emerald-100'
        : 'bg-emerald-500/15'
      : sprint.status === 'current'
        ? mode === 'light'
          ? 'bg-amber-100'
          : 'bg-amber-500/15'
        : mode === 'light'
          ? 'bg-zinc-200'
          : 'bg-white/10'

  const cardBg =
    sprint.status === 'current'
      ? mode === 'light'
        ? 'bg-white border-zinc-200 shadow-lg shadow-amber-500/10'
        : 'bg-zinc-900/80 border-white/15 shadow-2xl shadow-amber-500/10'
      : mode === 'light'
        ? 'bg-white border-zinc-200'
        : 'bg-zinc-900/40 border-white/10'

  const statusBadge =
    sprint.status === 'completed'
      ? mode === 'light'
        ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
        : 'bg-white/5 text-white/70 border-white/10'
      : sprint.status === 'current'
        ? mode === 'light'
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : mode === 'light'
          ? 'bg-zinc-100 text-zinc-500 border-zinc-200'
          : 'bg-white/5 text-white/50 border-white/10'

  return (
    <section
      data-sprint-id={sprint.id}
      onClick={onSelect}
      className={`group rounded-2xl border transition-[opacity,box-shadow] duration-300 ${cardBg} ${
        isFocused ? '' : 'opacity-95 hover:opacity-100'
      }`}
    >
      <header className="grid grid-cols-[1fr_auto_auto_auto_auto] items-start gap-x-6 gap-y-3 px-5 pt-4 pb-3">
        <div className="col-span-1 flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`truncate text-base font-semibold ${t.text}`}>
              {sprint.name}
            </h3>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] tracking-wider uppercase ${statusBadge}`}
            >
              {sprint.status === 'completed'
                ? 'Completed'
                : sprint.status === 'current'
                  ? 'Current'
                  : 'Upcoming'}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] tracking-wider uppercase ${t.surfaceMuted} ${t.textMuted}`}
            >
              {sprint.from} → {sprint.to}
            </span>
            <span
              className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
            >
              · Sprint {sprint.number}
            </span>
          </div>
          <div className={`h-2 overflow-hidden rounded-full ${trackBg}`}>
            <div
              className={`h-full ${progressColor} transition-all duration-700`}
              style={{ width: `${sprint.percent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-end justify-start">
          <span className={`text-sm tabular-nums ${t.text}`}>
            {sprint.percent}%
          </span>
        </div>
        <Stat label="Scope" value={`${sprint.scope} tickets`} />
        <Stat
          label="Started"
          value={`${sprint.startedCount} · ${sprint.startedPct}%`}
        />
        <Stat
          label="Completed"
          value={`${sprint.completedCount} · ${sprint.completedPct}%`}
        />
      </header>

      <div className={`border-t ${t.border} flex flex-col gap-4 px-5 py-4`}>
        <SprintToolbar />
        <SprintTasks
          tasks={tasks}
          expandedTaskId={expandedTaskId}
          onToggleTask={onToggleTask}
          comments={comments}
          activity={activity}
          onChangeStatus={onChangeStatus}
          onChangePriority={onChangePriority}
          onChangeAssignee={onChangeAssignee}
          onAddComment={onAddComment}
        />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { t } = useDashTheme()
  return (
    <div className="flex min-w-[88px] flex-col">
      <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
        {label}
      </span>
      <span className={`text-xs ${t.text}`}>{value}</span>
    </div>
  )
}

function SprintToolbar() {
  const { t } = useDashTheme()
  const team = useTeam()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs ${t.btn}`}
        >
          <Filter className="size-3.5" />
          Filter
        </button>
        <div className="flex items-center -space-x-1">
          {team.map((m) => (
            <Avatar
              key={m.id}
              user={m}
              size={22}
              className="ring-2 ring-current/0"
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ToolbarPill label="Status" />
        <ToolbarPill label="Assignee" />
        <div
          className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
        >
          <button
            className={`flex size-7 items-center justify-center rounded ${t.btnActive}`}
            aria-label="List"
          >
            <ListIcon className="size-3.5" />
          </button>
          <button
            className={`flex size-7 items-center justify-center rounded ${t.tab}`}
            aria-label="Board"
          >
            <Columns3 className="size-3.5" />
          </button>
        </div>
        <button
          className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
          aria-label="Settings"
        >
          <SettingsIcon className="size-3.5" />
        </button>
        <button
          className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
          aria-label="Notifications"
        >
          <Bell className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function ToolbarPill({ label }: { label: string }) {
  const { t } = useDashTheme()
  return (
    <button
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs ${t.btn}`}
    >
      {label}
      <ChevronRight className="size-3 rotate-90" />
    </button>
  )
}

function SprintTasks({
  tasks,
  expandedTaskId,
  onToggleTask,
  comments,
  activity,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment
}: {
  tasks: BoardTask[]
  expandedTaskId: string | null
  onToggleTask: (id: string) => void
  comments: Record<string, TaskCommentLite[]>
  activity: Record<string, TaskActivityLite[]>
  onChangeStatus: (id: string, s: import('./status').TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
}) {
  const { t } = useDashTheme()
  const grouped = useMemo(() => {
    const byStatus = new Map<import('./status').TaskStatus, BoardTask[]>()
    tasks.forEach((task) => {
      const list = byStatus.get(task.status) ?? []
      list.push(task)
      byStatus.set(task.status, list)
    })
    return STATUSES.map((s) => ({
      status: s,
      items: byStatus.get(s.id) ?? []
    })).filter((group) => group.items.length > 0)
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <p className={`text-xs italic ${t.textSubtle} py-6 text-center`}>
        No tasks in this sprint.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ status, items }) => (
        <div key={status.id} className="flex flex-col">
          <header className="mb-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 ${t.surfaceMuted}`}
            >
              <StatusIcon status={status.id} className="size-3.5" />
              <span className={`text-xs ${t.text}`}>{status.label}</span>
              <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
                {items.length}
              </span>
            </span>
            <button
              className={`flex size-5 items-center justify-center rounded text-base leading-none ${t.tab}`}
              aria-label="Add"
            >
              +
            </button>
          </header>
          <ul className="flex flex-col">
            {items.map((task) => (
              <ArchiveRow
                key={task.id}
                task={task}
                expanded={expandedTaskId === task.id}
                onToggle={() => onToggleTask(task.id)}
                comments={comments[task.id] ?? []}
                activity={activity[task.id] ?? []}
                onChangeStatus={onChangeStatus}
                onChangePriority={onChangePriority}
                onChangeAssignee={onChangeAssignee}
                onAddComment={onAddComment}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ArchiveRow({
  task,
  expanded,
  onToggle,
  comments,
  activity,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment
}: {
  task: BoardTask
  expanded: boolean
  onToggle: () => void
  comments: TaskCommentLite[]
  activity: TaskActivityLite[]
  onChangeStatus: (id: string, s: import('./status').TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
}) {
  const { t } = useDashTheme()
  const checklistDone = task.checklist?.filter((c) => c.done).length ?? 0
  const checklistTotal = task.checklist?.length ?? 0
  const checklistPct =
    checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0

  return (
    <li
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`group flex cursor-pointer flex-col gap-1.5 border-b px-2 py-2.5 ${t.dividerSoft} ${
        expanded ? '' : t.rowHover
      }`}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={task.status} className="mt-1 size-3.5 shrink-0" />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`text-sm leading-tight ${t.text}`}>
            {task.title}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {task.assignee && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar user={task.assignee} size={18} />
                <span className={`text-xs ${t.textMuted}`}>
                  {task.assignee.name}
                </span>
              </span>
            )}
            {task.tags?.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 text-[10px] tracking-wider uppercase ${t.textMuted}`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    task.priority === 'urgent' ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                />
                {tag}
              </span>
            ))}
            {task.relations?.slice(0, 2).map((r, i) => (
              <span
                key={`${r.kind}-${r.ref}-${i}`}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t.metaTag}`}
              >
                <RelationIcon kind={r.kind} className="size-3" />
                {r.ref}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span
            title={PRIORITY_LABEL[task.priority]}
            className="inline-flex items-center"
          >
            <PriorityIcon priority={task.priority} className="size-4" />
          </span>

          {checklistTotal > 0 && (
            <span
              title={`${checklistDone} of ${checklistTotal} steps done`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 ${t.metaTag}`}
            >
              <span className="relative size-3.5">
                <svg viewBox="0 0 16 16" className="size-3.5">
                  <circle
                    cx="8"
                    cy="8"
                    r="6.2"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="6.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${(checklistPct / 100) * (Math.PI * 12.4)} ${Math.PI * 12.4}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 8 8)"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className={`text-[10px] tabular-nums ${t.text}`}>
                {checklistDone}/{checklistTotal}
              </span>
            </span>
          )}

          <span
            className={`hidden text-[10px] tracking-wider uppercase md:inline ${t.textSubtle}`}
          >
            {task.due ?? '—'}
          </span>
          <span
            className={`hidden text-[10px] tracking-wider uppercase md:inline ${t.textSubtle}`}
          >
            {task.ref}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`mt-2 ml-6 rounded-lg border p-4 ${t.border} ${t.surfaceMuted}`}
        >
          <TaskDetailContent
            task={task}
            comments={comments}
            activity={activity}
            onChangeStatus={onChangeStatus}
            onChangePriority={onChangePriority}
            onChangeAssignee={onChangeAssignee}
            onAddComment={onAddComment}
            showHeader
            onClose={onToggle}
            compact
          />
        </div>
      )}
    </li>
  )
}
