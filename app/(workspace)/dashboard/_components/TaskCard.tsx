'use client'

import { Copy, Trash2, ExternalLink, Files, Filter } from 'lucide-react'
import { BoardTask } from './boardData'
import { useTeam } from './TeamContext'
import {
  STATUS_BY_ID,
  STATUSES,
  PRIORITY_LABEL,
  RELATION_LABEL,
  TaskPriority,
  TaskStatus
} from './status'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import StatusIcon from './StatusIcon'
import Avatar from './Avatar'
import { useDashTheme } from './theme'
import { useContextMenu } from './ContextMenu'
import { useTaskActions } from './actions'

interface TaskCardProps {
  task: BoardTask
  onClick?: () => void
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const { t } = useDashTheme()
  const { open } = useContextMenu()
  const a = useTaskActions()
  const team = useTeam()
  const status = STATUS_BY_ID[task.status]
  const pill = t.pillStatus[task.status]

  const handleContext = (e: React.MouseEvent) => {
    open(e, [
      {
        id: 'open',
        label: 'Open task',
        icon: <ExternalLink className="size-3.5" />,
        shortcut: '↵',
        onSelect: () => a.openDetail(task.id)
      },
      {
        id: 'status',
        label: 'Change status',
        icon: <StatusIcon status={task.status} />,
        submenu: STATUSES.map((s) => ({
          id: `status-${s.id}`,
          label: s.label,
          icon: <StatusIcon status={s.id} />,
          onSelect: () => a.changeStatus(task.id, s.id)
        }))
      },
      {
        id: 'priority',
        label: 'Change priority',
        icon: <PriorityIcon priority={task.priority} />,
        submenu: PRIORITIES.map((p) => ({
          id: `prio-${p}`,
          label: PRIORITY_LABEL[p],
          icon: <PriorityIcon priority={p} />,
          onSelect: () => a.changePriority(task.id, p)
        }))
      },
      {
        id: 'assignee',
        label: 'Assign to',
        icon: task.assignee ? <Avatar user={task.assignee} size={16} /> : null,
        submenu: [
          {
            id: 'unassign',
            label: 'Unassigned',
            onSelect: () => a.changeAssignee(task.id, null)
          },
          ...team.map((m) => ({
            id: `assignee-${m.id}`,
            label: m.name,
            icon: <Avatar user={m} size={16} />,
            onSelect: () => a.changeAssignee(task.id, m.id)
          }))
        ]
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'duplicate',
        label: 'Duplicate task',
        icon: <Files className="size-3.5" />,
        onSelect: () => a.duplicate(task.id)
      },
      {
        id: 'copy',
        label: 'Copy reference',
        icon: <Copy className="size-3.5" />,
        shortcut: '⌘C',
        onSelect: () => a.copyRef(task.ref)
      },
      {
        id: 'filter-status',
        label: `Filter by ${status.label}`,
        icon: <Filter className="size-3.5" />,
        onSelect: () => a.setStatusFilter(task.status)
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'delete',
        label: 'Delete task',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        onSelect: () => a.remove(task.id)
      }
    ])
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={handleContext}
      data-card
      className={`group w-full text-left rounded-lg border transition px-3 py-2.5 flex flex-col gap-2 ${t.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] uppercase tracking-[0.18em] ${t.textSubtle}`}
        >
          {task.ref}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${pill}`}
        >
          {status.label}
        </span>
      </div>

      <p className={`text-[13px] leading-snug ${t.text} line-clamp-2`}>
        {task.title}
      </p>

      {task.relations && task.relations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {task.relations.map((r, i) => (
            <span
              key={`${r.kind}-${r.ref}-${i}`}
              title={`${RELATION_LABEL[r.kind]} ${r.ref}`}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${t.metaTag}`}
            >
              <RelationIcon kind={r.kind} className="size-3" />
              {r.ref}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          <span
            title={PRIORITY_LABEL[task.priority]}
            className="inline-flex items-center justify-center"
          >
            <PriorityIcon priority={task.priority} />
          </span>
          {task.tags?.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${t.metaTag}`}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {task.due && (
            <span
              className={`text-[10px] uppercase tracking-wider ${t.textMuted}`}
            >
              {task.due}
            </span>
          )}
          {task.assignee && <Avatar user={task.assignee} size={20} />}
        </div>
      </div>
    </button>
  )
}
