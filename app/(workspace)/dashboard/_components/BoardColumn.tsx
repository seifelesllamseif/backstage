'use client'

import { Plus, Filter, Trash2, Inbox } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
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
  selectedTaskId?: string | null
  onSelect: (id: string) => void
  onAdd?: () => void
  density?: 'compact' | 'cozy'
  wipLimit?: number
  // dnd-kit droppable id for the column body. Drag/drop only activates
  // when this is provided (board view); list/timeline views skip it.
  droppableId?: string
}

export default function BoardColumn({
  title,
  statusId,
  tasks,
  selectedTaskId,
  onSelect,
  onAdd,
  density = 'cozy',
  wipLimit = 0,
  droppableId
}: BoardColumnProps) {
  const { t } = useDashTheme()
  const { open } = useContextMenu()
  const a = useTaskActions()
  const overLimit = wipLimit > 0 && tasks.length > wipLimit

  // Always call hooks unconditionally; pass a placeholder id when DnD
  // is disabled (which can't collide with the col:<status> namespace).
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? `__no-dnd:${title}`,
    disabled: !droppableId
  })

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
        onSelect: () => statusId && a.toggleStatusFilter(statusId)
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
      ref={setNodeRef}
      onContextMenu={columnMenu}
      className={`flex flex-col w-[260px] shrink-0 rounded-xl border backdrop-blur-sm transition ${t.column} ${
        isOver ? 'ring-2 ring-teal-500/30 ring-offset-0' : ''
      }`}
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
        className={`flex flex-col overflow-y-auto flex-1 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          density === 'compact' ? 'gap-1 p-1.5' : 'gap-2 p-2'
        }`}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selected={selectedTaskId === task.id}
              draggable={Boolean(droppableId)}
              onClick={() => onSelect(task.id)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && isOver && (
          <div
            className="rounded-lg border-2 border-dashed border-teal-400/60 bg-teal-500/5 px-3 py-2.5 min-h-[78px]"
            aria-hidden
          />
        )}
        {tasks.length === 0 && !isOver && (
          <button
            type="button"
            onClick={onAdd ?? (() => statusId && a.addInColumn(statusId))}
            className={`group flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-center transition ${t.border} ${t.textSubtle} hover:${t.text}`}
            aria-label={`Add task to ${title}`}
          >
            <Inbox className="size-4 opacity-60 group-hover:opacity-100" />
            <span className="text-[11px]">Nothing in {title.toLowerCase()}</span>
            <span className={`text-[10px] ${t.textFaint}`}>
              Click to add a task
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
