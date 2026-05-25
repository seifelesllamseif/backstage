'use client'

import { Plus, Filter, Trash2 } from 'lucide-react'
import { BoardTask } from './boardData'
import { TaskStatus } from './status'
import StatusIcon from './StatusIcon'
import TaskCard from './TaskCard'
import { useDashTheme } from './theme'
import { useContextMenu } from './ContextMenu'
import { useTaskActions } from './actions'

interface BoardColumnProps {
  title: string
  statusId?: TaskStatus
  tasks: BoardTask[]
  onSelect: (id: string) => void
  onAdd?: () => void
  density?: 'compact' | 'cozy'
  wipLimit?: number
}

export default function BoardColumn({
  title,
  statusId,
  tasks,
  onSelect,
  onAdd,
  density = 'cozy',
  wipLimit = 0
}: BoardColumnProps) {
  const { t } = useDashTheme()
  const { open } = useContextMenu()
  const a = useTaskActions()
  const overLimit = wipLimit > 0 && tasks.length > wipLimit

  const columnMenu = (e: React.MouseEvent) => {
    open(e, [
      {
        id: 'add',
        label: 'Add task here',
        icon: <Plus className="size-3.5" />,
        shortcut: 'N',
        onSelect: onAdd ?? (() => a.addInColumn(statusId)),
        disabled: !onAdd && !statusId
      },
      {
        id: 'filter',
        label: statusId ? `Filter by ${title}` : 'Filter by this group',
        icon: <Filter className="size-3.5" />,
        disabled: !statusId,
        onSelect: () => statusId && a.setStatusFilter(statusId)
      },
      { id: 'sep', label: '', separator: true },
      {
        id: 'clear',
        label: `Delete ${tasks.length} task${tasks.length === 1 ? '' : 's'} here`,
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        disabled: tasks.length === 0,
        onSelect: () => tasks.forEach((task) => a.remove(task.id))
      }
    ])
  }

  return (
    <div
      onContextMenu={columnMenu}
      className={`flex flex-col w-[260px] shrink-0 rounded-xl border backdrop-blur-sm ${t.column}`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b ${t.columnHeader}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {statusId && (
            <StatusIcon status={statusId} className="size-3.5 shrink-0" />
          )}
          <span
            className={`text-xs uppercase tracking-wider truncate ${t.text}`}
          >
            {title}
          </span>
          <span
            className={`text-[10px] tabular-nums ${
              overLimit ? 'text-red-500 font-semibold' : t.textSubtle
            }`}
          >
            {tasks.length}
            {wipLimit > 0 && `/${wipLimit}`}
          </span>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className={`size-5 rounded ${t.btn} text-base leading-none flex items-center justify-center transition`}
            aria-label="Add task"
          >
            +
          </button>
        )}
      </div>
      <div
        className={`flex flex-col overflow-y-auto flex-1 min-h-0 ${
          density === 'compact' ? 'gap-1 p-1.5' : 'gap-2 p-2'
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onSelect(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <p
            className={`text-xs italic px-2 py-4 text-center ${t.textSubtle}`}
          >
            Empty
          </p>
        )}
      </div>
    </div>
  )
}
