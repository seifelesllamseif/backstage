'use client'

import { X } from 'lucide-react'
import { STATUSES, TaskPriority, TaskStatus, PRIORITY_LABEL } from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import { useTeam } from './TeamContext'
import { useDashTheme } from './theme'

// Multi-select filter panel. Each category (status / priority / assignee /
// tag) holds an array of selected values; clicking a chip toggles
// membership. An "Any" chip in each row clears that category. A summary
// strip at the top shows every active value as a removable pill so the
// user can always see — and undo — what's filtered without scanning the
// whole panel.

interface FilterPanelProps {
  open: boolean
  onClose: () => void
  statusFilter: TaskStatus[]
  onToggleStatus: (s: TaskStatus) => void
  onClearStatus: () => void
  priorityFilter: TaskPriority[]
  onTogglePriority: (p: TaskPriority) => void
  onClearPriority: () => void
  assigneeFilter: string[]
  onToggleAssignee: (id: string) => void
  onClearAssignee: () => void
  tagFilter: string[]
  onToggleTag: (tag: string) => void
  onClearTag: () => void
  allTags: string[]
  // Sprint filter. The panel only renders the chip group when there are
  // sprints to pick from; in projects with no sprints the row stays hidden.
  sprintFilter: string[]
  onToggleSprint: (cycleId: string) => void
  onClearSprint: () => void
  allSprints: {
    id: string
    name: string
    status: 'upcoming' | 'current' | 'completed'
    number: number
  }[]
  onReset: () => void
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function FilterPanel({
  open,
  onClose,
  statusFilter,
  onToggleStatus,
  onClearStatus,
  priorityFilter,
  onTogglePriority,
  onClearPriority,
  assigneeFilter,
  onToggleAssignee,
  onClearAssignee,
  tagFilter,
  onToggleTag,
  onClearTag,
  allTags,
  sprintFilter,
  onToggleSprint,
  onClearSprint,
  allSprints,
  onReset
}: FilterPanelProps) {
  const { t } = useDashTheme()
  const team = useTeam()
  if (!open) return null

  const activePills: { id: string; label: string; onRemove: () => void }[] = []
  for (const s of statusFilter) {
    const label = STATUSES.find((x) => x.id === s)?.label ?? s
    activePills.push({
      id: `status-${s}`,
      label: `Status: ${label}`,
      onRemove: () => onToggleStatus(s)
    })
  }
  for (const p of priorityFilter) {
    activePills.push({
      id: `priority-${p}`,
      label: `Priority: ${PRIORITY_LABEL[p]}`,
      onRemove: () => onTogglePriority(p)
    })
  }
  for (const id of assigneeFilter) {
    const member = team.find((m) => m.id === id)
    activePills.push({
      id: `assignee-${id}`,
      label: `Assignee: ${member?.name ?? id}`,
      onRemove: () => onToggleAssignee(id)
    })
  }
  for (const tag of tagFilter) {
    activePills.push({
      id: `tag-${tag}`,
      label: `Tag: ${tag}`,
      onRemove: () => onToggleTag(tag)
    })
  }
  for (const id of sprintFilter) {
    const sprint = allSprints.find((s) => s.id === id)
    activePills.push({
      id: `sprint-${id}`,
      label: `Sprint: ${sprint?.name ?? id}`,
      onRemove: () => onToggleSprint(id)
    })
  }
  const hasActive = activePills.length > 0

  return (
    <div
      className={`flex flex-col gap-3 border-b px-4 py-3 ${t.topbar}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] uppercase tracking-[0.22em] ${t.textMuted}`}
        >
          Filters {hasActive && `(${activePills.length})`}
        </span>
        <div className="flex items-center gap-2">
          {hasActive && (
            <button
              onClick={onReset}
              className={`text-[10px] uppercase tracking-wider underline-offset-2 hover:underline ${t.textMuted}`}
            >
              Reset all
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close filters"
            className={`size-6 rounded ${t.btn} flex items-center justify-center`}
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {hasActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activePills.map((pill) => (
            <button
              key={pill.id}
              onClick={pill.onRemove}
              className={`group flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] tracking-wider uppercase transition ${t.chipActive}`}
            >
              <span>{pill.label}</span>
              <X className="size-2.5 opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <ChipGroup label="Status">
          <Chip
            active={statusFilter.length === 0}
            onClick={() => onClearStatus()}
          >
            Any
          </Chip>
          {STATUSES.map((s) => (
            <Chip
              key={s.id}
              active={statusFilter.includes(s.id)}
              onClick={() => onToggleStatus(s.id)}
            >
              <StatusIcon status={s.id} className="size-3" />
              {s.label}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Priority">
          <Chip
            active={priorityFilter.length === 0}
            onClick={() => onClearPriority()}
          >
            Any
          </Chip>
          {PRIORITIES.map((p) => (
            <Chip
              key={p}
              active={priorityFilter.includes(p)}
              onClick={() => onTogglePriority(p)}
            >
              <PriorityIcon priority={p} className="size-3" />
              {PRIORITY_LABEL[p]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Assignee">
          <Chip
            active={assigneeFilter.length === 0}
            onClick={() => onClearAssignee()}
          >
            Any
          </Chip>
          {team.map((m) => (
            <Chip
              key={m.id}
              active={assigneeFilter.includes(m.id)}
              onClick={() => onToggleAssignee(m.id)}
            >
              <span
                className={`flex size-3.5 items-center justify-center rounded-full text-[8px] font-semibold text-white ${m.color}`}
              >
                {m.initials}
              </span>
              {m.name}
            </Chip>
          ))}
        </ChipGroup>

        {allTags.length > 0 && (
          <ChipGroup label="Tag">
            <Chip
              active={tagFilter.length === 0}
              onClick={() => onClearTag()}
            >
              Any
            </Chip>
            {allTags.map((tag) => (
              <Chip
                key={tag}
                active={tagFilter.includes(tag)}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </Chip>
            ))}
          </ChipGroup>
        )}

        {allSprints.length > 0 && (
          <ChipGroup label="Sprint">
            <Chip
              active={sprintFilter.length === 0}
              onClick={() => onClearSprint()}
            >
              Any
            </Chip>
            {allSprints.map((sprint) => (
              <Chip
                key={sprint.id}
                active={sprintFilter.includes(sprint.id)}
                onClick={() => onToggleSprint(sprint.id)}
              >
                <span className="tabular-nums opacity-70">
                  #{sprint.number}
                </span>
                <span className="max-w-[140px] truncate">{sprint.name}</span>
              </Chip>
            ))}
          </ChipGroup>
        )}
      </div>
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
    <div className="flex items-center gap-1.5">
      <span
        className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
      >
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
      className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] tracking-wider uppercase transition ${
        active ? t.chipActive : t.chip
      }`}
    >
      {children}
    </button>
  )
}
