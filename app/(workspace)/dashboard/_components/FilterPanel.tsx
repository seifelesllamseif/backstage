'use client'

import { X } from 'lucide-react'
import { STATUSES, TaskPriority, TaskStatus, PRIORITY_LABEL } from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import { useTeam } from './TeamContext'
import { useDashTheme } from './theme'

interface FilterPanelProps {
  open: boolean
  onClose: () => void
  statusFilter: TaskStatus | null
  onStatusFilter: (s: TaskStatus | null) => void
  priorityFilter: TaskPriority | null
  onPriorityFilter: (p: TaskPriority | null) => void
  assigneeFilter: string | null
  onAssigneeFilter: (id: string | null) => void
  tagFilter: string | null
  onTagFilter: (tag: string | null) => void
  allTags: string[]
  onReset: () => void
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function FilterPanel({
  open,
  onClose,
  statusFilter,
  onStatusFilter,
  priorityFilter,
  onPriorityFilter,
  assigneeFilter,
  onAssigneeFilter,
  tagFilter,
  onTagFilter,
  allTags,
  onReset
}: FilterPanelProps) {
  const { t } = useDashTheme()
  const team = useTeam()
  if (!open) return null

  return (
    <div className={`border-b px-4 py-3 flex flex-wrap items-center gap-2 ${t.topbar}`}>
      <span className={`text-[10px] uppercase tracking-wider ${t.textMuted} mr-1`}>
        Filters
      </span>

      <ChipGroup label="Status">
        <Chip active={!statusFilter} onClick={() => onStatusFilter(null)}>
          Any
        </Chip>
        {STATUSES.map((s) => (
          <Chip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => onStatusFilter(s.id)}
          >
            <StatusIcon status={s.id} className="size-3" />
            {s.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup label="Priority">
        <Chip active={!priorityFilter} onClick={() => onPriorityFilter(null)}>
          Any
        </Chip>
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            active={priorityFilter === p}
            onClick={() => onPriorityFilter(p)}
          >
            <PriorityIcon priority={p} className="size-3" />
            {PRIORITY_LABEL[p]}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup label="Assignee">
        <Chip active={!assigneeFilter} onClick={() => onAssigneeFilter(null)}>
          Any
        </Chip>
        {team.map((m) => (
          <Chip
            key={m.id}
            active={assigneeFilter === m.id}
            onClick={() => onAssigneeFilter(m.id)}
          >
            <span
              className={`size-3.5 rounded-full text-[8px] font-semibold flex items-center justify-center text-white ${m.color}`}
            >
              {m.initials}
            </span>
            {m.name}
          </Chip>
        ))}
      </ChipGroup>

      {allTags.length > 0 && (
        <ChipGroup label="Tag">
          <Chip active={!tagFilter} onClick={() => onTagFilter(null)}>
            Any
          </Chip>
          {allTags.map((tag) => (
            <Chip
              key={tag}
              active={tagFilter === tag}
              onClick={() => onTagFilter(tag)}
            >
              {tag}
            </Chip>
          ))}
        </ChipGroup>
      )}

      <button
        onClick={onReset}
        className={`ml-auto text-[10px] uppercase tracking-wider underline-offset-2 hover:underline ${t.textMuted}`}
      >
        Reset
      </button>
      <button
        onClick={onClose}
        className={`size-6 rounded ${t.btn} flex items-center justify-center`}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

function ChipGroup({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] uppercase tracking-wider ${t.textSubtle}`}>
        {label}:
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] uppercase tracking-wider transition ${
        active ? t.chipActive : t.chip
      }`}
    >
      {children}
    </button>
  )
}
