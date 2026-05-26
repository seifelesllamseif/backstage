'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Trash2, X } from 'lucide-react'
import { STATUSES, TaskPriority, TaskStatus, PRIORITY_LABEL } from './status'
import { BoardAssignee, BoardTask, TaskRelation } from './boardData'
import RelationPicker from './RelationPicker'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import { useDashTheme } from './theme'
import {
  buildBulkTaskPrompt,
  parseBulkTaskJson,
  type ParsedBulkTask
} from './bulkPrompt'

interface NewTaskModalProps {
  open: boolean
  defaultStatus?: TaskStatus
  members: BoardAssignee[]
  labels: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  defaultProjectId: string | null
  // Pool for the relation picker autocomplete. Visible tasks scoped by
  // the caller.
  candidateTasks: { id: string; ref: string; title: string; status: TaskStatus }[]
  onClose: () => void
  onCreate: (
    task: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'>
  ) => void
  onCreateBulk: (
    projectId: string,
    drafts: {
      title: string
      description: string | null
      status: TaskStatus
      priority: TaskPriority
      assigneeId: string | null
      dueDate: string | null
      labelIds: string[]
      newLabelNames: string[]
      relations?: { kind: 'blocked_by' | 'blocks' | 'parent' | 'sub_issue' | 'triage'; ref: string }[]
    }[]
  ) => Promise<void> | void
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

type Tab = 'manual' | 'ai'

export default function NewTaskModal({
  open,
  defaultStatus = 'todo',
  members,
  labels,
  projects,
  defaultProjectId,
  candidateTasks,
  onClose,
  onCreate,
  onCreateBulk
}: NewTaskModalProps) {
  const { t } = useDashTheme()
  const [tab, setTab] = useState<Tab>('manual')

  // Two-phase open/close so the panel can animate in *and* out. The dialog
  // stays mounted briefly after `open` flips false so the exit keyframes
  // (fade-out + zoom-out) can play before the node leaves the tree.
  const [mounted, setMounted] = useState(open)
  const [state, setState] = useState<'open' | 'closed'>(
    open ? 'open' : 'closed'
  )

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setState('open'))
      return () => cancelAnimationFrame(raf)
    }
    setState('closed')
    const timer = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-state={state}
        className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 absolute inset-0 bg-black/60 backdrop-blur-sm duration-200"
        onClick={onClose}
      />
      <div
        data-state={state}
        className={`data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative w-full max-w-lg rounded-xl border shadow-2xl duration-200 ${t.detail} ${
          tab === 'ai' ? 'max-w-2xl' : ''
        }`}
      >
        <div
          className={`flex h-12 items-center justify-between border-b px-5 ${t.border}`}
        >
          <div className="flex items-center gap-1">
            <TabButton
              active={tab === 'manual'}
              onClick={() => setTab('manual')}
            >
              Manual
            </TabButton>
            <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
              From AI
            </TabButton>
          </div>
          <button
            onClick={onClose}
            className={`flex size-7 items-center justify-center rounded-md transition ${t.btn}`}
          >
            <X className="size-3.5" />
          </button>
        </div>

        {tab === 'manual' ? (
          <ManualTab
            defaultStatus={defaultStatus}
            members={members}
            candidateTasks={candidateTasks}
            onClose={onClose}
            onCreate={onCreate}
          />
        ) : (
          <AiTab
            members={members}
            labels={labels}
            projects={projects}
            defaultProjectId={defaultProjectId}
            candidateTasks={candidateTasks}
            onClose={onClose}
            onCreateBulk={onCreateBulk}
          />
        )}
      </div>
    </div>
  )
}

// ─── Manual tab (unchanged from before, lifted into its own component) ───

function ManualTab({
  defaultStatus,
  members,
  candidateTasks,
  onClose,
  onCreate
}: {
  defaultStatus: TaskStatus
  members: BoardAssignee[]
  candidateTasks: {
    id: string
    ref: string
    title: string
    status: TaskStatus
  }[]
  onClose: () => void
  onCreate: (
    task: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'>
  ) => void
}) {
  const { t } = useDashTheme()
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [pendingRelations, setPendingRelations] = useState<TaskRelation[]>([])

  const reset = () => {
    setTitle('')
    setStatus(defaultStatus)
    setPriority('medium')
    setAssigneeId(null)
    setDue('')
    setTagsInput('')
    setPendingRelations([])
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
      due: due.trim() || undefined,
      relations: pendingRelations.length > 0 ? pendingRelations : undefined
    })
    reset()
    onClose()
  }

  return (
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

      <Field label="Relations">
        <RelationPicker
          relations={pendingRelations}
          candidates={candidateTasks}
          variant="spacious"
          onAdd={(rel) =>
            setPendingRelations((cur) => {
              // Dedup on (kind, ref).
              if (
                cur.some((r) => r.kind === rel.kind && r.ref === rel.ref)
              ) {
                return cur
              }
              return [...cur, rel]
            })
          }
          onRemove={(rel) =>
            setPendingRelations((cur) =>
              cur.filter(
                (r) => !(r.kind === rel.kind && r.ref === rel.ref)
              )
            )
          }
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
  )
}

// ─── AI tab: copy prompt, paste JSON, edit preview, commit bulk ──────────

function AiTab({
  members,
  labels,
  projects,
  defaultProjectId,
  candidateTasks,
  onClose,
  onCreateBulk
}: {
  members: BoardAssignee[]
  labels: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  defaultProjectId: string | null
  candidateTasks: {
    id: string
    ref: string
    title: string
    status: TaskStatus
  }[]
  onClose: () => void
  onCreateBulk: (
    projectId: string,
    drafts: {
      title: string
      description: string | null
      status: TaskStatus
      priority: TaskPriority
      assigneeId: string | null
      dueDate: string | null
      labelIds: string[]
      newLabelNames: string[]
      relations?: {
        kind: 'blocked_by' | 'blocks' | 'parent' | 'sub_issue' | 'triage'
        ref: string
      }[]
    }[]
  ) => Promise<void> | void
}) {
  const { t } = useDashTheme()

  const [projectId, setProjectId] = useState<string | null>(
    defaultProjectId && projects.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : (projects[0]?.id ?? null)
  )
  const selectedProject = projectId
    ? (projects.find((p) => p.id === projectId) ?? null)
    : null

  const prompt = useMemo(
    () =>
      buildBulkTaskPrompt({
        projectName: selectedProject?.name ?? null,
        members: members.map((m) => ({ name: m.name })),
        labels: labels.map((l) => ({ name: l.name })),
        existingTasks: candidateTasks.map((task) => ({
          ref: task.ref,
          title: task.title
        }))
      }),
    [selectedProject, members, labels, candidateTasks]
  )

  const [copied, setCopied] = useState(false)
  const [pasted, setPasted] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ParsedBulkTask[] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: select the textarea so the user can copy manually.
    }
  }

  const parse = () => {
    const res = parseBulkTaskJson(pasted, {
      members: members.map((m) => ({ id: m.id, name: m.name })),
      labels,
      existingTaskRefs: candidateTasks.map((task) => task.ref)
    })
    if (!res.ok) {
      setParseError(res.error)
      setDrafts(null)
      return
    }
    setParseError(null)
    setDrafts(res.tasks)
  }

  const updateDraft = (i: number, patch: Partial<ParsedBulkTask>) => {
    setDrafts((cur) =>
      cur ? cur.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) : cur
    )
  }

  const removeDraft = (i: number) => {
    setDrafts((cur) => (cur ? cur.filter((_, idx) => idx !== i) : cur))
  }

  const submit = async () => {
    if (!drafts || drafts.length === 0 || !projectId) return
    setSubmitting(true)
    try {
      await onCreateBulk(
        projectId,
        drafts.map((d) => ({
          title: d.title,
          description: d.description,
          status: d.status ?? 'backlog',
          priority: d.priority ?? 'medium',
          assigneeId: d.assigneeId,
          dueDate: d.dueDate,
          labelIds: d.labelIds,
          newLabelNames: d.unknownLabels,
          relations: d.relations.length > 0 ? d.relations : undefined
        }))
      )
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Preview state ─────────────────────────────────────────────────
  if (drafts) {
    return (
      <div className="flex max-h-[70vh] flex-col">
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          <div className={`text-xs ${t.textMuted}`}>
            {drafts.length} task{drafts.length === 1 ? '' : 's'} ready. Edit any
            row, delete with the trash icon, then create.
          </div>
          {drafts.map((d, i) => (
            <DraftRow
              key={i}
              draft={d}
              members={members}
              labels={labels}
              onChange={(patch) => updateDraft(i, patch)}
              onRemove={() => removeDraft(i)}
            />
          ))}
          {drafts.length === 0 && (
            <p className={`text-center text-xs italic ${t.textSubtle}`}>
              All rows removed. Re-parse the JSON or switch back to Manual.
            </p>
          )}
        </div>
        <div
          className={`flex items-center justify-between border-t px-5 py-3 ${t.border}`}
        >
          <button
            onClick={() => {
              setDrafts(null)
              setParseError(null)
            }}
            className={`h-9 rounded-md border px-3 text-xs transition ${t.btn}`}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`h-9 rounded-md border px-3 text-xs transition ${t.btn}`}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={drafts.length === 0 || submitting}
              className={`h-9 rounded-md px-3 text-xs transition disabled:opacity-40 ${t.accent}`}
            >
              {submitting
                ? 'Creating…'
                : `Create ${drafts.length} task${drafts.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Prompt + paste state ───────────────────────────────────────────
  const noProject = !projectId
  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-5">
      <Field label="Target project">
        {projects.length === 0 ? (
          <p className={`text-xs ${t.textMuted}`}>
            No projects yet. Ask an admin to create one.
          </p>
        ) : (
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className={`h-9 w-full rounded-md border px-2 text-xs focus:outline-none ${t.input}`}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <ol className={`flex flex-col gap-1 text-xs ${t.textMuted}`}>
        <li>1. Copy the prompt below.</li>
        <li>2. Paste it into Claude, or any AI. Replace the last line.</li>
        <li>
          3. Paste the AI&apos;s JSON response here. Edit before committing.
        </li>
      </ol>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}
          >
            Prompt
          </span>
          <button
            onClick={copyPrompt}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.btn}`}
          >
            {copied ? (
              <>
                <Check className="size-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3" /> Copy prompt
              </>
            )}
          </button>
        </div>
        <textarea
          id="ai-prompt-template"
          name="aiPromptTemplate"
          readOnly
          value={prompt}
          className={`h-20 resize-none rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed transition-all delay-300 duration-500 ease-in-out hover:h-64 focus:h-64 ${t.input}`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          Paste AI response (JSON)
        </span>
        <textarea
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value)
            if (parseError) setParseError(null)
          }}
          placeholder={'{\n  "tasks": [ ... ]\n}'}
          className={`h-36 resize-none rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed transition focus:border-zinc-400 focus:outline-none dark:focus:border-white/30 ${t.input}`}
        />
        {parseError && (
          <p className="mt-1 text-[11px] text-red-500">{parseError}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onClose}
          className={`h-9 rounded-md border px-3 text-xs transition ${t.btn}`}
        >
          Cancel
        </button>
        <button
          onClick={parse}
          disabled={!pasted.trim() || noProject}
          className={`h-9 rounded-md px-3 text-xs transition disabled:opacity-40 ${t.accent}`}
          title={noProject ? 'Pick a project first.' : undefined}
        >
          Parse
        </button>
      </div>
    </div>
  )
}

function DraftRow({
  draft,
  members,
  labels,
  onChange,
  onRemove
}: {
  draft: ParsedBulkTask
  members: BoardAssignee[]
  labels: { id: string; name: string }[]
  onChange: (patch: Partial<ParsedBulkTask>) => void
  onRemove: () => void
}) {
  const { t } = useDashTheme()
  const labelSet = useMemo(() => new Set(draft.labelIds), [draft.labelIds])

  const toggleLabel = (id: string) => {
    const next = new Set(labelSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ labelIds: [...next] })
  }

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${t.column}`}>
      <div className="flex items-start gap-2">
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
        />
        <button
          onClick={onRemove}
          aria-label="Remove this task"
          className={`flex size-8 items-center justify-center rounded-md border transition ${t.btn}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <textarea
        value={draft.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value || null })}
        placeholder="Description (optional)"
        className={`min-h-12 resize-none rounded-md border px-2 py-1.5 text-[11px] ${t.input}`}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.status ?? ''}
          onChange={(e) =>
            onChange({ status: (e.target.value || null) as TaskStatus | null })
          }
          className={`h-8 rounded-md border px-2 text-[11px] ${t.input}`}
        >
          <option value="">— status —</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={draft.priority ?? ''}
          onChange={(e) =>
            onChange({
              priority: (e.target.value || null) as TaskPriority | null
            })
          }
          className={`h-8 rounded-md border px-2 text-[11px] ${t.input}`}
        >
          <option value="">— priority —</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select
          value={draft.assigneeId ?? ''}
          onChange={(e) => onChange({ assigneeId: e.target.value || null })}
          className={`h-8 rounded-md border px-2 text-[11px] ${t.input}`}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={draft.dueDate ?? ''}
          onChange={(e) => onChange({ dueDate: e.target.value || null })}
          placeholder="YYYY-MM-DD"
          className={`h-8 rounded-md border px-2 text-[11px] ${t.input}`}
        />
      </div>

      {(labels.length > 0 || draft.unknownLabels.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => {
            const active = labelSet.has(l.id)
            return (
              <button
                key={l.id}
                onClick={() => toggleLabel(l.id)}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  active ? t.btnActive : t.tab
                }`}
              >
                {l.name}
              </button>
            )
          })}
          {draft.unknownLabels.map((name) => (
            <button
              key={`new:${name}`}
              onClick={() =>
                onChange({
                  unknownLabels: draft.unknownLabels.filter((n) => n !== name)
                })
              }
              title="Click to remove. Will be created as a new label on save."
              className={`rounded-full border border-dashed px-2 py-0.5 text-[10px] transition ${t.tab}`}
            >
              + {name}
            </button>
          ))}
        </div>
      )}

      {draft.unknownLabels.length > 0 && (
        <p className={`pl-1 text-[10px] ${t.textSubtle}`}>
          New label{draft.unknownLabels.length === 1 ? '' : 's'} will be
          created: {draft.unknownLabels.join(', ')}. Click a chip to drop it.
        </p>
      )}

      {draft.warnings.length > 0 && (
        <ul className="flex flex-col gap-0.5 pl-1">
          {draft.warnings.map((w, i) => (
            <li key={i} className="text-[10px] text-amber-500">
              • {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs transition ${
        active ? t.btnActive : t.tab
      }`}
    >
      {children}
    </button>
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
