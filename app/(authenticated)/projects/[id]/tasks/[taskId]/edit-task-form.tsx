'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { taskStatuses, type TaskStatus } from '@/lib/business-logic'
import { updateTask, type UpdateTaskState } from '../../actions'

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  unscoped: 'Unscoped',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  canceled: 'Canceled',
  duplicate: 'Duplicate'
}

type Assignee = { id: string; fullName: string; avatarInitials: string | null }

export function EditTaskForm({
  task,
  assignees,
  projectId
}: {
  task: {
    id: string
    title: string
    description: string | null
    status: TaskStatus
    assigneeId: string | null
    dueDate: Date | null
  }
  assignees: Assignee[]
  projectId: string
}) {
  const [state, action, pending] = useActionState<UpdateTaskState, FormData>(
    updateTask,
    undefined
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="taskId" value={task.id} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Title</span>
        <input
          name="title"
          type="text"
          defaultValue={task.title}
          maxLength={200}
          required
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Description</span>
        <textarea
          name="description"
          defaultValue={task.description ?? ''}
          rows={4}
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span>Status</span>
          <select
            name="status"
            defaultValue={task.status}
            className="border-border bg-background rounded-md border px-2 py-2 text-sm"
          >
            {taskStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span>Assignee</span>
          <select
            name="assigneeId"
            defaultValue={task.assigneeId ?? ''}
            className="border-border bg-background rounded-md border px-2 py-2 text-sm"
          >
            <option value="">— Unassigned —</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Due date</span>
        <input
          name="dueDate"
          type="date"
          defaultValue={
            task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ''
          }
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
        />
      </label>

      {state?.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to board
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
