'use client'

import { useState } from 'react'
import {
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link as LinkIcon,
  MessageCircleQuestion,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import {
  defaultExternalRefLabel,
  parseExternalRef
} from '@/lib/externalRef'
import type { TaskExternalRef, TaskExternalRefKind } from './boardData'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import MentionInput, { renderMentionedBody } from './MentionInput'
import { BoardTask } from './boardData'
import { useTeam } from './TeamContext'
import { STATUS_BY_ID, STATUSES, TaskStatus, TaskPriority, PRIORITY_LABEL } from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import Avatar from './Avatar'
import { RELATION_LABEL } from './status'
import { useDashTheme } from './theme'

export interface TaskComment {
  id: string
  author: string
  // DB id of the author (null if the author has been deleted). Used by
  // the drawer to decide whether to show edit/delete on the row.
  authorId: string | null
  // Initials for the author avatar in the drawer.
  authorInitials: string
  body: string
  at: string
  // ISO string when the comment was last edited; undefined if never.
  editedAt?: string
  mentions?: string[]
}

export interface TaskActivity {
  id: string
  kind: 'status' | 'comment' | 'attachment' | 'created' | 'priority' | 'assignee'
  text: string
  at: string
  atRaw: string
}

interface TaskDetailProps {
  task: BoardTask | null
  comments: TaskComment[]
  activity: TaskActivity[]
  externalRefs: TaskExternalRef[]
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onChangeStatus: (id: string, s: TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
  onEditComment: (commentId: string, body: string) => void
  onDeleteComment: (commentId: string) => void
  onAddExternalRef: (taskId: string, url: string) => void
  onRemoveExternalRef: (taskId: string, refId: string) => void
  // Optional copy-button slot. DashboardShell owns the export context and
  // injects a CopyButton here so the task header gets a Copy task action
  // without TaskDetail having to know about lib/export.
  copySlot?: React.ReactNode
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function TaskDetail({
  task,
  comments,
  activity,
  externalRefs,
  currentUserId,
  isAdmin,
  onClose,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddExternalRef,
  onRemoveExternalRef,
  copySlot
}: TaskDetailProps) {
  const { t } = useDashTheme()
  const team = useTeam()
  const [statusOpen, setStatusOpen] = useState(false)
  const [prioOpen, setPrioOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  // Comment currently being edited (id) + its draft body. Only one
  // comment edits at a time in the drawer.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  if (!task) return null
  const status = STATUS_BY_ID[task.status]

  // Outer chrome (position, overlay, close button, ESC handling, focus
  // trap) is provided by the parent <Sheet> in DashboardShell. This
  // component is content-only.
  return (
    <div className={`flex flex-col h-full ${t.detail}`}>
      <div className={`flex items-center justify-between gap-3 px-4 h-12 border-b ${t.border}`}>
        <span className={`text-[10px] uppercase tracking-[0.22em] ${t.textSubtle}`}>
          {task.ref}
        </span>
        {copySlot}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        <h2 className={`text-lg font-medium leading-snug ${t.text}`}>{task.title}</h2>

        <div className="grid grid-cols-[88px_1fr] gap-y-2.5 text-xs items-center">
          <FieldLabel>Status</FieldLabel>
          <Popover
            open={statusOpen}
            onOpenChange={setStatusOpen}
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <StatusIcon status={task.status} />
                {status.label}
              </span>
            }
          >
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onChangeStatus(task.id, s.id)
                  setStatusOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded ${
                  task.status === s.id ? t.btnActive : t.tab
                }`}
              >
                <StatusIcon status={s.id} />
                {s.label}
              </button>
            ))}
          </Popover>

          <FieldLabel>Priority</FieldLabel>
          <Popover
            open={prioOpen}
            onOpenChange={setPrioOpen}
            trigger={
              <span className="inline-flex items-center gap-1.5">
                <PriorityIcon priority={task.priority} />
                {PRIORITY_LABEL[task.priority]}
              </span>
            }
          >
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onChangePriority(task.id, p)
                  setPrioOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded ${
                  task.priority === p ? t.btnActive : t.tab
                }`}
              >
                <PriorityIcon priority={p} />
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </Popover>

          <FieldLabel>Assignee</FieldLabel>
          <Popover
            open={assigneeOpen}
            onOpenChange={setAssigneeOpen}
            trigger={
              task.assignee ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar user={task.assignee} size={20} />
                  {task.assignee.name}
                </span>
              ) : (
                <span className={t.textSubtle}>Unassigned</span>
              )
            }
          >
            <button
              onClick={() => {
                onChangeAssignee(task.id, null)
                setAssigneeOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded ${
                !task.assignee ? t.btnActive : t.tab
              }`}
            >
              <span className="size-5 rounded-full bg-zinc-200 dark:bg-white/10 text-[9px] font-semibold flex items-center justify-center">
                —
              </span>
              Unassigned
            </button>
            {team.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onChangeAssignee(task.id, m.id)
                  setAssigneeOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded ${
                  task.assignee?.id === m.id ? t.btnActive : t.tab
                }`}
              >
                <Avatar user={m} size={20} />
                {m.name}
              </button>
            ))}
          </Popover>

          <FieldLabel>Due</FieldLabel>
          <span className={t.text}>{task.due ?? '—'}</span>

          <FieldLabel>Tags</FieldLabel>
          <span className="flex flex-wrap gap-1">
            {task.tags?.map((tag) => (
              <span
                key={tag}
                className={`border rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${t.metaTag}`}
              >
                {tag}
              </span>
            )) ?? <span className={t.textSubtle}>—</span>}
          </span>

          {task.relations && task.relations.length > 0 && (
            <>
              <FieldLabel>Relations</FieldLabel>
              <span className="flex flex-wrap gap-1.5">
                {task.relations.map((r, i) => (
                  <span
                    key={`${r.kind}-${r.ref}-${i}`}
                    className={`inline-flex items-center gap-1.5 border rounded-md px-2 py-1 text-[11px] ${t.metaTag}`}
                  >
                    <RelationIcon kind={r.kind} className="size-3.5" />
                    <span className={t.textMuted}>
                      {RELATION_LABEL[r.kind]}
                    </span>
                    <span className={`uppercase tracking-wider text-[10px] ${t.text}`}>
                      {r.ref}
                    </span>
                  </span>
                ))}
              </span>
            </>
          )}
        </div>

        <div>
          <div className={`text-[10px] uppercase tracking-[0.22em] mb-2 ${t.textMuted}`}>
            Comments ({comments.length})
          </div>
          <div className="flex flex-col gap-2">
            {comments.length === 0 && (
              <p className={`text-xs italic ${t.textSubtle}`}>No comments yet.</p>
            )}
            {comments.map((c) => {
              const canManage =
                isAdmin || (c.authorId !== null && c.authorId === currentUserId)
              const isEditing = editingId === c.id
              return (
                <div
                  key={c.id}
                  className={`group rounded-md border px-3 py-2 text-xs ${t.border} ${t.surfaceMuted}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`shrink-0 size-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${t.surface} border ${t.border} ${t.text}`}
                        aria-hidden
                      >
                        {c.authorInitials}
                      </span>
                      <span className={`font-medium truncate ${t.text}`}>
                        {c.author}
                      </span>
                      {c.editedAt && (
                        <span className={`text-[10px] italic ${t.textSubtle}`}>
                          (edited)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] ${t.textSubtle}`}>{c.at}</span>
                      {canManage && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id)
                              setEditDraft(c.body)
                            }}
                            aria-label="Edit comment"
                            className={`size-5 rounded opacity-0 group-hover:opacity-100 transition flex items-center justify-center ${t.btn}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                aria-label="Delete comment"
                                className={`size-5 rounded opacity-0 group-hover:opacity-100 transition flex items-center justify-center ${t.btn}`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This comment will be permanently removed.
                                  Activity log keeps the deletion event.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteComment(c.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={Math.min(6, Math.max(2, editDraft.split('\n').length))}
                        autoFocus
                        className={`w-full resize-y rounded border px-2 py-1.5 text-xs ${t.input}`}
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setEditDraft('')
                          }}
                          className={`h-6 px-2 rounded text-[11px] ${t.btn}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = editDraft.trim()
                            if (!trimmed || trimmed === c.body) {
                              setEditingId(null)
                              return
                            }
                            onEditComment(c.id, trimmed)
                            setEditingId(null)
                          }}
                          className={`h-6 px-2 rounded text-[11px] inline-flex items-center gap-1 ${t.accent}`}
                        >
                          <Check className="size-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`${t.textMuted} leading-snug whitespace-pre-wrap`}>
                      {renderMentionedBody(c.body, team)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <LinksSection
          task={task}
          refs={externalRefs}
          onAdd={(url) => onAddExternalRef(task.id, url)}
          onRemove={(refId) => onRemoveExternalRef(task.id, refId)}
        />

        <div className="flex flex-col gap-2 text-xs">
          <div className={`text-[10px] uppercase tracking-[0.22em] ${t.textMuted}`}>
            Activity
          </div>
          {activity.length === 0 && (
            <p className={`text-xs italic ${t.textSubtle}`}>Nothing yet.</p>
          )}
          {activity.map((a) => {
            const Icon =
              a.kind === 'comment'
                ? MessageSquare
                : a.kind === 'attachment'
                  ? Paperclip
                  : GitBranch
            return (
              <div key={a.id} className={`flex items-start gap-2 ${t.textMuted}`}>
                <span className={`mt-0.5 ${t.textSubtle}`}>
                  <Icon className="size-3" />
                </span>
                <span className="leading-snug">
                  {a.text}{' '}
                  <span className={`text-[10px] ${t.textSubtle}`}>· {a.at}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`border-t p-3 ${t.border}`}>
        <MentionInput
          onSubmit={(body, mentions) => onAddComment(task.id, body, mentions)}
        />
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { t } = useDashTheme()
  return (
    <div
      className={`uppercase tracking-wider text-[10px] py-1 ${t.textSubtle}`}
    >
      {children}
    </div>
  )
}

function Popover({
  trigger,
  children,
  open,
  onOpenChange
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useDashTheme()
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
          open ? t.btnActive : t.btn
        }`}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-9 z-40 w-52 rounded-md border shadow-xl py-1 ${t.detail}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// External refs section (PR / issue / commit / doc / link). Auto-detects
// kind from the pasted URL (lib/externalRef.ts). The chip label falls
// back to a sensible default (e.g. "PR #123", "github.com") when the row
// doesn't carry an explicit label.
function refIcon(kind: TaskExternalRefKind) {
  switch (kind) {
    case 'pr':
      return GitPullRequest
    case 'issue':
      return MessageCircleQuestion
    case 'commit':
      return GitCommit
    case 'doc':
      return FileText
    case 'link':
    default:
      return LinkIcon
  }
}

function LinksSection({
  task,
  refs,
  onAdd,
  onRemove
}: {
  task: BoardTask
  refs: TaskExternalRef[]
  onAdd: (url: string) => void
  onRemove: (refId: string) => void
}) {
  const { t } = useDashTheme()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const parsed = parseExternalRef(trimmed)
    if (!parsed) {
      setErr('Not a valid URL.')
      return
    }
    onAdd(parsed.url)
    setUrl('')
    setErr(null)
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <div
          className={`text-[10px] uppercase tracking-[0.22em] ${t.textMuted}`}
        >
          Links
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
          >
            <Plus className="size-3" /> Add
          </button>
        )}
      </div>

      {refs.length === 0 && !adding && (
        <p className={`text-xs italic ${t.textSubtle}`}>
          No PRs, issues or docs linked yet.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {refs.map((ref) => {
          const parsed = parseExternalRef(ref.url)
          const label =
            ref.label ??
            (parsed ? defaultExternalRefLabel(parsed) : ref.url)
          const Icon = refIcon(ref.kind)
          return (
            <li
              key={ref.id}
              className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${t.column}`}
            >
              <Icon className={`size-3.5 shrink-0 ${t.textMuted}`} />
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${t.text}`}
                title={ref.url}
              >
                <span className="truncate">{label}</span>
                <ExternalLink className={`size-3 shrink-0 ${t.textSubtle}`} />
              </a>
              <button
                onClick={() => onRemove(ref.id)}
                className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
                aria-label="Remove link"
              >
                <X className="size-3" />
              </button>
            </li>
          )
        })}
      </ul>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (err) setErr(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setUrl('')
                  setErr(null)
                  setAdding(false)
                }
              }}
              placeholder="Paste a PR, issue, doc or any URL…"
              className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
            />
            <button
              type="submit"
              className={`h-8 rounded-md px-2.5 text-[10px] ${t.accent}`}
              disabled={!url.trim()}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setUrl('')
                setErr(null)
                setAdding(false)
              }}
              className={`flex size-8 items-center justify-center rounded-md border ${t.btn}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
          {err && <p className="text-[11px] text-red-500">{err}</p>}
        </form>
      )}
    </div>
  )
}
