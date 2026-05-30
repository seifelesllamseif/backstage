'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import type { BoardTask, Sprint, SprintStatus } from './boardData'
import {
  addTaskToSprint,
  createSprint,
  deleteSprint,
  removeTaskFromSprint,
  updateSprint
} from '../actions'
import { useDashTheme } from './theme'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface SprintsPanelProps {
  projectId: string
  sprints: Sprint[]
  // Lifted setter from DashboardShell so a drag/drop can update the parent's
  // sprints state synchronously (true optimistic UI). The server confirms in
  // the background; on error we restore from the snapshot.
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>
  tasks: BoardTask[]
  accessTier: 'admin' | 'lead' | 'member'
  onOpenTask: (taskId: string) => void
  // Optional per-sprint copy-button factory. DashboardShell owns the export
  // context and injects a CopyButton per sprint.
  renderSprintCopySlot?: (sprintId: string) => React.ReactNode
}

const STATUS_META: Record<
  SprintStatus,
  { label: string; icon: typeof CheckCircle2 }
> = {
  upcoming: { label: 'Upcoming', icon: CircleDashed },
  current: { label: 'Current', icon: Loader2 },
  completed: { label: 'Completed', icon: CheckCircle2 }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((to - from) / 86400000)
}

// Re-derive scope/progress numbers locally after an optimistic taskIds
// edit. Mirrors the math in mappers.ts mapSprint so the hero + cards
// update instantly without waiting for a server refresh.
function recomputeSprintCounts(
  sprint: Sprint,
  taskIds: string[],
  allTasks: BoardTask[]
): Sprint {
  const inSprint = allTasks.filter((task) => taskIds.includes(task.id))
  const scope = inSprint.length
  const startedCount = inSprint.filter(
    (task) => task.status !== 'backlog' && task.status !== 'unscoped'
  ).length
  const completedCount = inSprint.filter(
    (task) => task.status === 'done'
  ).length
  return {
    ...sprint,
    taskIds,
    scope,
    startedCount,
    startedPct: scope ? Math.round((startedCount / scope) * 100) : 0,
    completedCount,
    completedPct: scope ? Math.round((completedCount / scope) * 100) : 0,
    percent: scope ? Math.round((completedCount / scope) * 100) : 0
  }
}

export default function SprintsPanel({
  projectId,
  sprints,
  setSprints,
  tasks,
  accessTier,
  onOpenTask,
  renderSprintCopySlot
}: SprintsPanelProps) {
  const { t } = useDashTheme()
  const router = useRouter()
  const canEdit = accessTier === 'admin' || accessTier === 'lead'
  const [pending, startTransition] = useTransition()
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Sprint | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Sprints come pre-sorted by (status asc, number desc) from the server.
  // For the planning view we want chronological-ish order: current first,
  // then upcoming (low → high number), then completed (most recent first).
  const sortedSprints = useMemo(() => {
    const order: Record<SprintStatus, number> = {
      current: 0,
      upcoming: 1,
      completed: 2
    }
    return [...sprints].sort((a, b) => {
      const so = order[a.status] - order[b.status]
      if (so !== 0) return so
      if (a.status === 'completed') return b.number - a.number
      return a.number - b.number
    })
  }, [sprints])

  const scheduledTaskIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of sprints) for (const id of c.taskIds) s.add(id)
    return s
  }, [sprints])

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !scheduledTaskIds.has(task.id)),
    [tasks, scheduledTaskIds]
  )

  const handleCreate = (input: {
    name: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
    status: SprintStatus
  }) => {
    startTransition(async () => {
      const res = await createSprint({
        projectId,
        name: input.name,
        description: input.description.trim() || null,
        docUrl: input.docUrl.trim() || null,
        fromDate: input.fromDate,
        toDate: input.toDate,
        status: input.status
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Sprint created.')
      setShowNew(false)
      router.refresh()
    })
  }

  const handleUpdate = (
    sprintId: string,
    input: {
      name: string
      description: string
      docUrl: string
      fromDate: string
      toDate: string
      status: SprintStatus
    }
  ) => {
    startTransition(async () => {
      const res = await updateSprint({
        sprintId,
        name: input.name,
        description: input.description.trim() || null,
        docUrl: input.docUrl.trim() || null,
        fromDate: input.fromDate,
        toDate: input.toDate,
        status: input.status
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Sprint updated.')
      setEditingId(null)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const target = pendingDelete
    startTransition(async () => {
      const res = await deleteSprint(target.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Sprint deleted.')
      setPendingDelete(null)
      router.refresh()
    })
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(e.active.id as string)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const taskId = e.active.id as string
    const overId = e.over?.id
    if (!overId || typeof overId !== 'string') return
    if (!overId.startsWith('sprint-')) return
    const sprintId = overId.slice('sprint-'.length)

    // No-op if the task is already in this sprint.
    const targetSprint = sprints.find((c) => c.id === sprintId)
    if (!targetSprint || targetSprint.taskIds.includes(taskId)) return

    // Snapshot for rollback, then optimistically add the task to the
    // target sprint (and remove from any other sprint — a task can only
    // belong to one at a time in this UX).
    setSprints((cur) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return cur.map((c) => {
        if (c.id === sprintId) {
          if (c.taskIds.includes(taskId)) return c
          const taskIds = [...c.taskIds, taskId]
          return recomputeSprintCounts(c, taskIds, tasks)
        }
        if (c.taskIds.includes(taskId)) {
          const taskIds = c.taskIds.filter((id) => id !== taskId)
          return recomputeSprintCounts(c, taskIds, tasks)
        }
        return c
      })
    })

    startTransition(async () => {
      const res = await addTaskToSprint({ sprintId, taskId })
      if ('error' in res) {
        toast.error(res.error)
        // Rollback by re-fetching the server's authoritative state.
        router.refresh()
        return
      }
      // Don't refresh on success — the optimistic state already matches
      // what the server now has. Refreshing would just cause a flash.
    })
  }

  const handleRemoveTask = (sprintId: string, taskId: string) => {
    // Optimistic remove first.
    setSprints((cur) =>
      cur.map((c) => {
        if (c.id !== sprintId) return c
        const taskIds = c.taskIds.filter((id) => id !== taskId)
        return recomputeSprintCounts(c, taskIds, tasks)
      })
    )
    startTransition(async () => {
      const res = await removeTaskFromSprint({ sprintId, taskId })
      if ('error' in res) {
        toast.error(res.error)
        router.refresh()
      }
    })
  }

  const activeDragTask = activeDragId
    ? (tasks.find((task) => task.id === activeDragId) ?? null)
    : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="h-full overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          <header className="flex items-baseline justify-between">
            <div>
              <h2 className={`text-2xl font-medium ${t.text}`}>Sprints</h2>
              <p className={`mt-1 text-sm ${t.textMuted}`}>
                Plan sprints for this project. Set a description as the
                Definition of Done, mark one as Current, and drag tasks into a
                sprint to scope it.
              </p>
            </div>
            {canEdit && !showNew && (
              <button
                onClick={() => setShowNew(true)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
              >
                <Plus className="size-3.5" /> New sprint
              </button>
            )}
          </header>

          {canEdit && showNew && (
            <SprintForm
              initial={{
                name: '',
                description: '',
                docUrl: '',
                fromDate: todayIso(),
                toDate: addDaysIso(todayIso(), 13),
                status: 'upcoming'
              }}
              submitLabel="Create sprint"
              submitting={pending}
              onSubmit={handleCreate}
              onCancel={() => setShowNew(false)}
            />
          )}

          <AlertDialog
            open={pendingDelete !== null}
            onOpenChange={(open) => {
              if (!open && !pending) setPendingDelete(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingDelete
                    ? `"${pendingDelete.name}" will be removed. Its tasks stay in the project — they just go back to Unscheduled.`
                    : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault()
                    confirmDelete()
                  }}
                >
                  {pending ? 'Deleting…' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="flex flex-col gap-3">
              {sortedSprints.length === 0 ? (
                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center ${t.border}`}
                >
                  <p className={`text-sm ${t.text}`}>No sprints yet</p>
                  <p className={`max-w-sm text-xs ${t.textMuted}`}>
                    {canEdit
                      ? 'Click "New sprint" to plan the first one.'
                      : 'Sprints will show up here once an admin or lead creates one.'}
                  </p>
                </div>
              ) : (
                sortedSprints.map((sprint) => {
                  const tasksInSprint = tasks.filter((task) =>
                    sprint.taskIds.includes(task.id)
                  )
                  return (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      tasksInSprint={tasksInSprint}
                      canEdit={canEdit}
                      isEditing={editingId === sprint.id}
                      submitting={pending}
                      onStartEdit={() => setEditingId(sprint.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(input) => handleUpdate(sprint.id, input)}
                      onDelete={() => setPendingDelete(sprint)}
                      onOpenTask={onOpenTask}
                      onRemoveTask={(taskId) =>
                        handleRemoveTask(sprint.id, taskId)
                      }
                      copySlot={renderSprintCopySlot?.(sprint.id)}
                    />
                  )
                })
              )}
            </div>

            <UnscheduledColumn
              tasks={unscheduledTasks}
              onOpenTask={onOpenTask}
            />
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          <div
            className={`flex w-64 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs shadow-2xl ${t.surface} ${t.border}`}
          >
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
            >
              {activeDragTask.ref}
            </span>
            <span className={`truncate ${t.text}`}>
              {activeDragTask.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function SprintCard({
  sprint,
  tasksInSprint,
  canEdit,
  isEditing,
  submitting,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onOpenTask,
  onRemoveTask,
  copySlot
}: {
  sprint: Sprint
  tasksInSprint: BoardTask[]
  canEdit: boolean
  isEditing: boolean
  submitting: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (input: {
    name: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
    status: SprintStatus
  }) => void
  onDelete: () => void
  onOpenTask: (id: string) => void
  onRemoveTask: (taskId: string) => void
  copySlot?: React.ReactNode
}) {
  const { t } = useDashTheme()
  const { setNodeRef, isOver } = useDroppable({ id: `sprint-${sprint.id}` })

  const meta = STATUS_META[sprint.status]
  const Icon = meta.icon

  if (isEditing && canEdit) {
    return (
      <SprintForm
        initial={{
          name: sprint.name,
          description: sprint.description ?? '',
          docUrl: sprint.docUrl ?? '',
          fromDate: sprint.fromIso,
          toDate: sprint.toIso,
          status: sprint.status
        }}
        submitLabel="Save"
        submitting={submitting}
        onSubmit={onSave}
        onCancel={onCancelEdit}
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-xl border p-4 transition ${t.column} ${
        isOver
          ? 'border-teal-500 bg-teal-500/[0.04] ring-2 ring-teal-500/30 dark:bg-teal-500/10'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t.metaTag}`}
            >
              <Icon
                className={`size-3 ${sprint.status === 'current' ? 'animate-spin' : ''}`}
              />
              {meta.label}
            </span>
            <span className={`text-[10px] ${t.textSubtle}`}>
              #{sprint.number}
            </span>
          </div>
          <h3 className={`text-sm font-medium ${t.text}`}>{sprint.name}</h3>
          {sprint.description && (
            <p className={`text-xs leading-relaxed ${t.textMuted}`}>
              {sprint.description}
            </p>
          )}
          <div
            className={`mt-1 flex items-center gap-1.5 text-[11px] ${t.textMuted}`}
          >
            <CalendarRange className="size-3" />
            <span>
              {sprint.from} → {sprint.to}
            </span>
            <span className={t.textSubtle}>
              · {Math.max(0, daysBetween(sprint.fromIso, sprint.toIso) + 1)}d
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {sprint.docUrl && (
            <a
              href={sprint.docUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="Open plan doc"
              className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
            >
              <FileText className="size-3.5" />
            </a>
          )}
          {copySlot}
          {canEdit && (
            <>
              <button
                onClick={onStartEdit}
                disabled={submitting}
                className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${t.btn}`}
                aria-label="Edit sprint"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={onDelete}
                disabled={submitting}
                className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${t.btn} ${t.accentText}`}
                aria-label="Delete sprint"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${t.textMuted}`}>
          {sprint.scope === 0
            ? 'No tasks scheduled'
            : `${sprint.completedCount}/${sprint.scope} done`}
        </span>
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {sprint.percent}%
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${sprint.percent}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1">
        {tasksInSprint.length === 0 ? (
          <li
            className={`rounded-md border border-dashed px-3 py-3 text-center text-[11px] italic transition ${
              isOver
                ? 'border-teal-500 text-teal-600 dark:text-teal-300'
                : `${t.border} ${t.textSubtle}`
            }`}
          >
            {isOver
              ? 'Release to add to this sprint'
              : 'Drop a task here to scope it into this sprint'}
          </li>
        ) : (
          tasksInSprint.map((task) => (
            <li
              key={task.id}
              className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${t.column}`}
            >
              <button
                onClick={() => onOpenTask(task.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
                >
                  {task.ref}
                </span>
                <span className={`truncate ${t.text}`}>{task.title}</span>
              </button>
              {canEdit && (
                <button
                  onClick={() => onRemoveTask(task.id)}
                  className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
                  aria-label="Remove from sprint"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))
        )}
        {tasksInSprint.length > 0 && isOver && (
          <li
            className={`rounded-md border border-dashed border-teal-500 px-2.5 py-1.5 text-center text-[11px] italic text-teal-600 dark:text-teal-300`}
          >
            Release to add here
          </li>
        )}
      </ul>
    </div>
  )
}

function UnscheduledColumn({
  tasks,
  onOpenTask
}: {
  tasks: BoardTask[]
  onOpenTask: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <aside
      className={`flex h-fit flex-col gap-3 rounded-xl border p-4 ${t.column}`}
    >
      <header className="flex items-baseline justify-between">
        <h3
          className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
        >
          Unscheduled
        </h3>
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {tasks.length}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {tasks.length === 0 ? (
          <li className={`text-xs italic ${t.textSubtle}`}>
            All tasks are in a sprint.
          </li>
        ) : (
          tasks.map((task) => (
            <DraggableTaskRow
              key={task.id}
              task={task}
              onOpenTask={onOpenTask}
            />
          ))
        )}
      </ul>
    </aside>
  )
}

function DraggableTaskRow({
  task,
  onOpenTask
}: {
  task: BoardTask
  onOpenTask: (id: string) => void
}) {
  const { t } = useDashTheme()
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenTask(task.id)}
      className={`flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition select-none ${t.column} ${
        isDragging ? 'opacity-40' : 'hover:border-zinc-400 dark:hover:border-white/30'
      }`}
    >
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums ${t.metaTag}`}
      >
        {task.ref}
      </span>
      <span className={`truncate ${t.text}`}>{task.title}</span>
    </li>
  )
}

function SprintForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel
}: {
  initial: {
    name: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
    status: SprintStatus
  }
  submitLabel: string
  submitting: boolean
  onSubmit: (input: {
    name: string
    description: string
    docUrl: string
    fromDate: string
    toDate: string
    status: SprintStatus
  }) => void
  onCancel: () => void
}) {
  const { t } = useDashTheme()
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [docUrl, setDocUrl] = useState(initial.docUrl)
  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)
  const [status, setStatus] = useState<SprintStatus>(initial.status)

  const canSubmit = name.trim().length >= 2 && fromDate <= toDate

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit({
          name: name.trim(),
          description,
          docUrl,
          fromDate,
          toDate,
          status
        })
      }}
      className={`flex flex-col gap-3 rounded-xl border p-4 ${t.column}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-medium tracking-wider uppercase ${t.textMuted}`}
        >
          Sprint details
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={`flex size-6 items-center justify-center rounded ${t.btn}`}
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sprint name (e.g. Sprint 1 — Supabase Audit)"
        className={`h-9 rounded-md border px-3 text-sm ${t.input}`}
        maxLength={80}
        required
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Definition of Done — what does this phase deliver?"
        className={`min-h-20 resize-none rounded-md border px-3 py-2 text-xs ${t.input}`}
        maxLength={1000}
      />

      <label className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Plan doc (optional)
        </span>
        <input
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://docs.google.com/… or https://github.com/.../wiki"
          className={`h-9 rounded-md border px-3 text-xs ${t.input}`}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
            Start
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
            End
          </span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SprintStatus)}
            className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
          >
            <option value="upcoming">Upcoming</option>
            <option value="current">Current</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className={`h-8 rounded-md px-3 text-xs disabled:opacity-50 ${t.accent}`}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
