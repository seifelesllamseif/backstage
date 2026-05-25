'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { STATUSES, TaskPriority, TaskStatus, PRIORITY_LABEL } from './status'
import { BoardAssignee, BoardTask } from './boardData'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import { useDashTheme } from './theme'

interface NewTaskModalProps {
  open: boolean
  defaultStatus?: TaskStatus
  members: BoardAssignee[]
  onClose: () => void
  onCreate: (
    task: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'>
  ) => void
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function NewTaskModal({
  open,
  defaultStatus = 'todo',
  members,
  onClose,
  onCreate
}: NewTaskModalProps) {
  const { t } = useDashTheme()
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  if (!open) return null

  const reset = () => {
    setTitle('')
    setStatus(defaultStatus)
    setPriority('medium')
    setAssigneeId(null)
    setDue('')
    setTagsInput('')
  }

  const submit = () => {
    if (!title.trim()) return
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    onCreate({
      title: title.trim(),
      status,
      priority,
      assignee: assigneeId
        ? members.find((m) => m.id === assigneeId)
        : undefined,
      tags: tags.length > 0 ? tags : undefined,
      due: due.trim() || undefined
    })
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-lg rounded-xl border shadow-2xl ${t.detail}`}
      >
        <div
          className={`flex h-12 items-center justify-between border-b px-5 ${t.border}`}
        >
          <h3 className={`text-sm font-medium ${t.text}`}>Create task</h3>
          <button
            onClick={onClose}
            className={`flex size-7 items-center justify-center rounded-md transition ${t.btn}`}
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            placeholder="Task title…"
            className={`h-10 rounded-md border px-3 text-sm transition focus:border-zinc-400 focus:outline-none dark:focus:border-white/30 ${t.input}`}
          />

          <textarea
            placeholder="Add a brief - what does the next person need?"
            className={`min-h-20 resize-none rounded-md border px-3 py-2 text-xs transition focus:border-zinc-400 focus:outline-none dark:focus:border-white/30 ${t.input}`}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignee">
              <select
                value={assigneeId ?? ''}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input
                value={due}
                onChange={(e) => setDue(e.target.value)}
                placeholder="May 28"
                className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
              />
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Audio, Marketing"
              className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1">
                <StatusIcon status={status} />
                <span className={t.textMuted}>preview</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <PriorityIcon priority={priority} />
                <span className={t.textMuted}>{PRIORITY_LABEL[priority]}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className={`h-9 rounded-md border px-3 text-xs transition ${t.btn}`}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!title.trim()}
                className={`h-9 rounded-md px-3 text-xs transition disabled:opacity-40 ${t.accent}`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
        {label}
      </span>
      {children}
    </label>
  )
}
