'use client'

import { useEffect, useState } from 'react'
import {
  Briefcase,
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link as LinkIcon,
  Loader2,
  MessageCircleQuestion,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import { defaultExternalRefLabel, parseExternalRef } from '@/lib/externalRef'
import type { TaskExternalRef, TaskExternalRefKind } from './boardData'
import { fetchTaskHandoff } from '../actions'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import {
  HANDOFF_FIELDS,
  HANDOFF_FIELD_LABELS,
  type HandoffFieldValues
} from '@/lib/handoff'
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
import { useTaskActions } from './actions'
import { Share2 } from 'lucide-react'
import {
  GithubIcon,
  FigmaIcon,
  SupabaseIcon,
  VerbivoreIcon,
  VercelIcon,
  SentryIcon,
  GoogleCloudIcon,
  StripeIcon
} from './BrandIcons'
import { Rabbit } from 'lucide-react'
import { BoardTask } from './boardData'
import { useTeam } from './TeamContext'
import {
  STATUS_BY_ID,
  STATUSES,
  TaskStatus,
  TaskPriority,
  PRIORITY_LABEL
} from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationPicker from './RelationPicker'
import type { TaskRelation } from './boardData'
import Avatar from './Avatar'
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
  // ISO timestamp when the comment was created. Used by the mentions
  // feed to decide whether the current user has already replied: a task
  // drops out of Mentions once the user posts a comment newer than the
  // most recent comment mentioning them.
  createdAt: string
  // ISO string when the comment was last edited; undefined if never.
  editedAt?: string
  mentions?: string[]
}

export interface TaskActivity {
  id: string
  kind:
    | 'status'
    | 'comment'
    | 'attachment'
    | 'created'
    | 'priority'
    | 'assignee'
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
  // Access tier of the current user. Planner fields (priority, assignee,
  // lead, due, relations) are admin/lead only; owner fields (status,
  // comments, links, handoff) are admin/lead OR the task assignee.
  accessTier: 'admin' | 'lead' | 'member'
  onClose: () => void
  onChangeStatus: (id: string, s: TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onChangeLead: (id: string, leadId: string | null) => void
  onChangeDueDate: (id: string, dueIso: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
  onEditComment: (commentId: string, body: string) => void
  onDeleteComment: (commentId: string) => void
  onAddExternalRef: (taskId: string, url: string) => void
  onRemoveExternalRef: (taskId: string, refId: string) => void
  // Pool of tasks the relation picker autocompletes against. Already
  // scoped by the parent to the member's visibility, so we don't filter
  // again here.
  candidateTasks: Pick<BoardTask, 'id' | 'ref' | 'title' | 'status'>[]
  onAddRelation: (taskId: string, rel: TaskRelation) => void
  onRemoveRelation: (taskId: string, rel: TaskRelation) => void
  // Opens the handoff sheet in editable mode for this task. The detail
  // panel uses this both for the "Edit handoff" button on a completed
  // task and as an entry point before the task is Done.
  onOpenHandoff: (task: BoardTask) => void
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
  accessTier,
  onClose,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onChangeLead,
  onChangeDueDate,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddExternalRef,
  onRemoveExternalRef,
  candidateTasks,
  onAddRelation,
  onRemoveRelation,
  onOpenHandoff,
  copySlot
}: TaskDetailProps) {
  const { t } = useDashTheme()
  const team = useTeam()
  const isPlanner = accessTier === 'admin' || accessTier === 'lead'
  const isAssignee = task?.assignee?.id === currentUserId
  // Planner fields: only admins / leads.
  const canEditPlanner = isPlanner
  // Owner fields: planners OR the task's own assignee. Mirrors the server
  // gate in mutations.ts -> ensureTaskAccess(taskId, 'owner').
  const canEditOwner = isPlanner || isAssignee
  const [statusOpen, setStatusOpen] = useState(false)
  const [prioOpen, setPrioOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)
  const [askLeadOpen, setAskLeadOpen] = useState(false)
  // Comment currently being edited (id) + its draft body. Only one
  // comment edits at a time in the drawer.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  // Share button: copies the absolute /dashboard/task/<ref> URL to
  // clipboard via the shared task-actions context (also used by the
  // card context menu's "Share link" entry). `shareCopied` flips the
  // icon from Share2 -> Check for a moment after click as inline visual
  // feedback (in addition to the toast).
  const taskActions = useTaskActions()
  const [shareCopied, setShareCopied] = useState(false)
  useEffect(() => {
    if (!shareCopied) return
    const id = window.setTimeout(() => setShareCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [shareCopied])

  if (!task) return null
  const status = STATUS_BY_ID[task.status]

  // Outer chrome (position, overlay, close button, ESC handling, focus
  // trap) is provided by the parent <Sheet> in DashboardShell. This
  // component is content-only.
  return (
    <div className={`flex h-full flex-col ${t.detail}`}>
      <div
        className={`flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 ${t.border}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex size-7 items-center justify-center rounded-md transition ${t.btn}`}
          >
            <X className="size-3.5" />
          </button>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] tracking-[0.22em] uppercase tabular-nums ${t.metaTag}`}
          >
            {task.ref}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              taskActions.copyShareLink(task.ref)
              setShareCopied(true)
            }}
            aria-label="Copy share link"
            title={shareCopied ? 'Copied!' : 'Copy share link'}
            className={`flex size-7 items-center justify-center rounded-md border transition ${
              shareCopied
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : t.btn
            }`}
          >
            {shareCopied ? (
              <Check className="size-3.5" />
            ) : (
              <Share2 className="size-3.5" />
            )}
          </button>
          {copySlot}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <h2 className={`text-xl leading-snug font-medium ${t.text}`}>
          {task.title}
        </h2>

        <div className="grid grid-cols-[88px_1fr] items-center gap-y-2.5 text-xs">
          <FieldLabel>Status</FieldLabel>
          <Popover
            disabled={!canEditOwner}
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
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
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
            disabled={!canEditPlanner}
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
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
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
            disabled={!canEditPlanner}
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
              className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
                !task.assignee ? t.btnActive : t.tab
              }`}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold dark:bg-white/10">
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
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
                  task.assignee?.id === m.id ? t.btnActive : t.tab
                }`}
              >
                <Avatar user={m} size={20} />
                {m.name}
              </button>
            ))}
          </Popover>

          <FieldLabel>Lead</FieldLabel>
          <div className="flex items-center gap-2">
            <Popover
              disabled={!canEditPlanner}
              open={leadOpen}
              onOpenChange={setLeadOpen}
              trigger={
                task.lead ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar user={task.lead} size={20} />
                    {task.lead.name}
                  </span>
                ) : (
                  <span className={t.textSubtle}>No lead</span>
                )
              }
            >
              <button
                onClick={() => {
                  onChangeLead(task.id, null)
                  setLeadOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
                  !task.lead ? t.btnActive : t.tab
                }`}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold dark:bg-white/10">
                  —
                </span>
                No lead
              </button>
              {team.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChangeLead(task.id, m.id)
                    setLeadOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs ${
                    task.lead?.id === m.id ? t.btnActive : t.tab
                  }`}
                >
                  <Avatar user={m} size={20} />
                  {m.name}
                </button>
              ))}
            </Popover>
            {task.lead &&
              task.assignee?.id === currentUserId &&
              task.lead.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => setAskLeadOpen(true)}
                  className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] transition ${t.accent}`}
                  title={`Ask ${task.lead.name} for help`}
                >
                  <MessageSquare className="size-3" />
                  Ask lead
                </button>
              )}
          </div>

          <FieldLabel>Due</FieldLabel>
          <DueDateField
            task={task}
            readOnly={!canEditPlanner}
            onChange={(iso) => onChangeDueDate(task.id, iso)}
          />

          <FieldLabel>Tags</FieldLabel>
          <span className="flex flex-wrap gap-1">
            {task.tags?.map((tag) => (
              <span
                key={tag}
                className={`rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t.metaTag}`}
              >
                {tag}
              </span>
            )) ?? <span className={t.textSubtle}>—</span>}
          </span>

          <FieldLabel>Relations</FieldLabel>
          <RelationPicker
            relations={task.relations ?? []}
            candidates={candidateTasks}
            selfRef={task.ref}
            disabled={!canEditPlanner}
            onAdd={(rel) => onAddRelation(task.id, rel)}
            onRemove={(rel) => onRemoveRelation(task.id, rel)}
            variant="compact"
          />
        </div>

        <LinksSection
          task={task}
          refs={externalRefs}
          canEdit={canEditOwner}
          onAdd={(url) => onAddExternalRef(task.id, url)}
          onRemove={(refId) => onRemoveExternalRef(task.id, refId)}
        />

        <HandoffReadView
          taskId={task.id}
          canEdit={canEditOwner}
          onOpenEditor={() => onOpenHandoff(task)}
        />

        <div>
          <div
            className={`mb-2 text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
          >
            Comments ({comments.length})
          </div>
          <div className="flex flex-col gap-2">
            {comments.length === 0 && (
              <p className={`text-xs italic ${t.textSubtle}`}>
                No comments yet.
              </p>
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
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${t.surface} border ${t.border} ${t.text}`}
                        aria-hidden
                      >
                        {c.authorInitials}
                      </span>
                      <span className={`truncate font-medium ${t.text}`}>
                        {c.author}
                      </span>
                      {c.editedAt && (
                        <span className={`text-[10px] italic ${t.textSubtle}`}>
                          (edited)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] ${t.textSubtle}`}>
                        {c.at}
                      </span>
                      {canManage && !isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id)
                              setEditDraft(c.body)
                            }}
                            aria-label="Edit comment"
                            className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.btn}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                aria-label="Delete comment"
                                className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.btn}`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete comment?
                                </AlertDialogTitle>
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
                        rows={Math.min(
                          6,
                          Math.max(2, editDraft.split('\n').length)
                        )}
                        autoFocus
                        className={`w-full resize-y rounded border px-2 py-1.5 text-xs ${t.input}`}
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setEditDraft('')
                          }}
                          className={`h-6 rounded px-2 text-[11px] ${t.btn}`}
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
                          className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] ${t.accent}`}
                        >
                          <Check className="size-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`${t.textMuted} leading-snug whitespace-pre-wrap`}
                    >
                      {renderMentionedBody(c.body, team)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <div
            className={`text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
          >
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
              <div
                key={a.id}
                className={`flex items-start gap-2 ${t.textMuted}`}
              >
                <span className={`mt-0.5 ${t.textSubtle}`}>
                  <Icon className="size-3" />
                </span>
                <span className="leading-snug">
                  {a.text}{' '}
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    · {a.at}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {canEditOwner ? (
        <div className={`border-t p-3 ${t.border}`}>
          <MentionInput
            onSubmit={(body, mentions) =>
              onAddComment(task.id, body, mentions)
            }
          />
        </div>
      ) : (
        <div
          className={`border-t px-3 py-2 text-[11px] italic ${t.border} ${t.textSubtle}`}
        >
          Only the assignee can comment on this task.
        </div>
      )}

      <AskLeadSheet
        open={askLeadOpen}
        onOpenChange={setAskLeadOpen}
        task={task}
        lead={task.lead ?? null}
        onSend={(body, mentions) => {
          onAddComment(task.id, body, mentions)
          setAskLeadOpen(false)
        }}
      />
    </div>
  )
}

// Small sheet that opens from the "Ask lead" button on the task detail.
// Pre-fills the comment with @-mention of the lead so the recipient sees
// it in their Mentions view. The actual post goes through the same
// addComment path as the regular comment box; nothing new server-side.
function AskLeadSheet({
  open,
  onOpenChange,
  task,
  lead,
  onSend
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  task: BoardTask
  lead: { id: string; name: string } | null
  onSend: (body: string, mentions: string[]) => void
}) {
  const { t } = useDashTheme()
  const [body, setBody] = useState('')

  // Reset draft when the sheet closes so each open starts clean.
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (!open) setBody('')
  }

  const send = () => {
    if (!lead) return
    const trimmed = body.trim()
    if (!trimmed) return
    const prefix = `@${lead.name} `
    // If the body already starts with the @mention (user kept the prefix
    // we suggested in the placeholder), don't double it.
    const finalBody = trimmed.startsWith(`@${lead.name}`)
      ? trimmed
      : `${prefix}${trimmed}`
    onSend(finalBody, [lead.id])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={`w-full p-0 sm:max-w-120! ${t.detail}`}
      >
        <VisuallyHidden.Root>
          <SheetTitle>
            {lead ? `Ask ${lead.name} about ${task.ref}` : 'Ask lead'}
          </SheetTitle>
        </VisuallyHidden.Root>

        {lead && (
          <div className={`flex h-full flex-col ${t.detail}`}>
            <header
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3 ${t.border}`}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div
                  className={`text-[10px] tracking-[0.22em] uppercase ${t.textSubtle}`}
                >
                  Ask lead
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${t.text}`}>
                    {lead.name}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-[0.22em] uppercase tabular-nums ${t.metaTag}`}
                  >
                    {task.ref}
                  </span>
                </div>
                <p className={`truncate text-xs ${t.textMuted}`}>
                  {task.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className={`flex size-7 items-center justify-center rounded-md transition ${t.btn}`}
              >
                <X className="size-3.5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className={`mb-3 text-xs leading-relaxed ${t.textMuted}`}>
                Sends a comment on this task that @-mentions {lead.name}.
                They&apos;ll see it in their Mentions view.
              </p>
              <textarea
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={`What's the question for ${lead.name}? They'll be tagged automatically.`}
                rows={6}
                className={`w-full resize-y rounded-md border px-3 py-2 text-xs leading-relaxed ${t.input}`}
              />
            </div>

            <footer
              className={`flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3 ${t.border}`}
            >
              <span className={`text-[10px] ${t.textSubtle}`}>
                <kbd className="font-mono">⌘</kbd>
                <kbd className="font-mono">↵</kbd> to send.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={`flex h-8 items-center rounded-md border px-3 text-xs transition ${t.btn}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!body.trim()}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.accent}`}
                >
                  <MessageSquare className="size-3.5" /> Send
                </button>
              </div>
            </footer>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { t } = useDashTheme()
  return (
    <div
      className={`py-1 text-[10px] tracking-wider uppercase ${t.textSubtle}`}
    >
      {children}
    </div>
  )
}

function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  disabled
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  open: boolean
  onOpenChange: (v: boolean) => void
  disabled?: boolean
}) {
  const { t } = useDashTheme()
  if (disabled) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs ${t.text}`}
      >
        {trigger}
      </span>
    )
  }
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
          className={`absolute top-9 left-0 z-40 w-52 rounded-md border py-1 shadow-xl ${t.detail}`}
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
    case 'github':
      return GithubIcon
    case 'figma':
      return FigmaIcon
    case 'supabase':
      return SupabaseIcon
    case 'verbivore':
      return VerbivoreIcon
    case 'vercel':
      return VercelIcon
    case 'bunny':
      return Rabbit
    case 'sentry':
      return SentryIcon
    case 'gcloud':
      return GoogleCloudIcon
    case 'stripe':
      return StripeIcon
    case 'link':
    default:
      return LinkIcon
  }
}

// Display ordering for ref chips - matches Panels.tsx. GitHub first since
// it's the most-used surface (PRs, code, issues), then infra (Supabase,
// Vercel, Bunny), then design (Figma), then brand-own (Verbivore), then
// the lower-priority generic sub-kinds.
const REF_KIND_ORDER: TaskExternalRefKind[] = [
  'github',
  'pr',
  'issue',
  'commit',
  'supabase',
  'vercel',
  'gcloud',
  'stripe',
  'bunny',
  'sentry',
  'figma',
  'verbivore',
  'doc',
  'link'
]

function sortRefsByImportance(refs: TaskExternalRef[]): TaskExternalRef[] {
  const rank = (k: TaskExternalRefKind) => {
    const i = REF_KIND_ORDER.indexOf(k)
    return i === -1 ? REF_KIND_ORDER.length : i
  }
  return [...refs].sort((a, b) => rank(a.kind) - rank(b.kind))
}

const REF_KIND_LABEL: Record<TaskExternalRefKind, string> = {
  pr: 'Pull request',
  issue: 'Issue',
  commit: 'Commit',
  doc: 'Document',
  link: 'Link',
  supabase: 'Supabase',
  github: 'GitHub repo',
  figma: 'Figma',
  verbivore: 'Verbivore',
  vercel: 'Vercel',
  bunny: 'Bunny CDN',
  sentry: 'Sentry',
  gcloud: 'Google Cloud',
  stripe: 'Stripe'
}

// Tone classes per ref kind. Mirrors the Updates panel palette so PRs /
// issues / docs read consistently across the dashboard.
function refTone(kind: TaskExternalRefKind, mode: 'light' | 'dark'): string {
  if (mode === 'light') {
    switch (kind) {
      case 'pr':
        return 'bg-violet-100 text-violet-700 border-violet-200'
      case 'issue':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'commit':
        return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'doc':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'github':
        return 'bg-zinc-100 text-zinc-900 border-zinc-300'
      case 'figma':
        return 'bg-pink-50 text-pink-700 border-pink-200'
      case 'supabase':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200'
      case 'verbivore':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'vercel':
        return 'bg-zinc-100 text-zinc-900 border-zinc-300'
      case 'bunny':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'sentry':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'gcloud':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'stripe':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      case 'link':
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    }
  }
  switch (kind) {
    case 'pr':
      return 'bg-violet-400/10 text-violet-300 border-violet-400/30'
    case 'issue':
      return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
    case 'commit':
      return 'bg-sky-400/10 text-sky-300 border-sky-400/30'
    case 'doc':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/30'
    case 'github':
      return 'bg-zinc-700/40 text-zinc-100 border-zinc-500/40'
    case 'figma':
      return 'bg-pink-400/10 text-pink-300 border-pink-400/30'
    case 'supabase':
      return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
    case 'verbivore':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/30'
    case 'vercel':
      return 'bg-zinc-700/40 text-zinc-100 border-zinc-500/40'
    case 'bunny':
      return 'bg-orange-400/10 text-orange-300 border-orange-400/30'
    case 'sentry':
      return 'bg-purple-400/10 text-purple-300 border-purple-400/30'
    case 'gcloud':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/30'
    case 'stripe':
      return 'bg-indigo-400/10 text-indigo-300 border-indigo-400/30'
    case 'link':
    default:
      return 'bg-white/5 text-white/70 border-white/20'
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Inline editable due date. Click the current value to edit. Server-side
// auto-tags the change as "postponed" or "early" when the task previously
// had a due date - see updateDashboardTaskDueDate in mutations.ts.
function DueDateField({
  task,
  readOnly,
  onChange
}: {
  task: BoardTask
  readOnly?: boolean
  onChange: (iso: string | null) => void
}) {
  const { t } = useDashTheme()
  const [editing, setEditing] = useState(false)
  // dueAt is a full ISO timestamp; the date input expects YYYY-MM-DD.
  const initial = task.dueAt ? task.dueAt.slice(0, 10) : ''
  const [value, setValue] = useState(initial)

  // Keep the editor in sync when the task changes from elsewhere (drag,
  // optimistic update, refetch).
  const [prevInitial, setPrevInitial] = useState(initial)
  if (prevInitial !== initial) {
    setPrevInitial(initial)
    setValue(initial)
  }

  if (readOnly) {
    return <span className={t.text}>{task.due ?? '—'}</span>
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left ${t.text} hover:opacity-80`}
        title="Edit due date"
      >
        {task.due ?? '—'}
      </button>
    )
  }

  const commit = (next: string) => {
    setEditing(false)
    const iso = next || null
    if (iso === (task.dueAt ? task.dueAt.slice(0, 10) : null)) return
    onChange(iso)
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        type="date"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(value)
          }
          if (e.key === 'Escape') {
            setValue(initial)
            setEditing(false)
          }
        }}
        className={`h-6 rounded-md border px-1.5 text-xs ${t.input}`}
      />
      {task.dueAt && (
        <button
          type="button"
          onClick={() => {
            setValue('')
            commit('')
          }}
          className={`text-[10px] underline ${t.textSubtle} hover:opacity-80`}
          title="Clear due date"
        >
          clear
        </button>
      )}
    </span>
  )
}

function LinksSection({
  refs,
  canEdit,
  onAdd,
  onRemove
}: {
  task: BoardTask
  refs: TaskExternalRef[]
  canEdit: boolean
  onAdd: (url: string) => void
  onRemove: (refId: string) => void
}) {
  const { t, mode } = useDashTheme()
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

  const showEmpty = refs.length === 0 && !adding

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center justify-between">
        <div
          className={`text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
        >
          Links {refs.length > 0 && `(${refs.length})`}
        </div>
        {canEdit && !adding && refs.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
          >
            <Plus className="size-3" /> Add link
          </button>
        )}
      </div>

      {showEmpty && (
        <div
          className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center ${t.border}`}
        >
          <LinkIcon className={`size-4 ${t.textSubtle}`} />
          <p className={`text-[11px] ${t.textMuted}`}>
            No PRs, issues, docs or links yet.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`mt-1 flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] transition ${t.accent}`}
            >
              <Plus className="size-3" /> Paste a URL
            </button>
          )}
        </div>
      )}

      {refs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sortRefsByImportance(refs).map((ref) => {
            const parsed = parseExternalRef(ref.url)
            const label =
              ref.label ?? (parsed ? defaultExternalRefLabel(parsed) : ref.url)
            const Icon = refIcon(ref.kind)
            const tone = refTone(ref.kind, mode)
            const sub =
              parsed?.repo ?? hostOf(ref.url) ?? REF_KIND_LABEL[ref.kind]
            // The Verbivore mark carries its own brand color in the SVG -
            // the amber border-tile fights with it. Render it borderless
            // and let the mark fill the tile.
            const isOwnBrand = ref.kind === 'verbivore'
            return (
              <li
                key={ref.id}
                className={`group flex items-center gap-3 rounded-lg border px-3 py-2 transition ${t.column} ${t.rowHover}`}
              >
                <span
                  className={
                    isOwnBrand
                      ? 'flex size-8 shrink-0 items-center justify-center'
                      : `flex size-8 shrink-0 items-center justify-center rounded-md border ${tone}`
                  }
                  aria-hidden="true"
                >
                  <Icon className={isOwnBrand ? 'size-8' : 'size-3.5'} />
                </span>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                  title={ref.url}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate text-xs font-medium ${t.text}`}>
                      {label}
                    </span>
                    <ExternalLink
                      className={`size-3 shrink-0 ${t.textSubtle}`}
                    />
                  </span>
                  <span
                    className={`flex items-center gap-1.5 text-[10px] ${t.textSubtle}`}
                  >
                    <span
                      className={`rounded border px-1 py-px tracking-wider uppercase ${t.metaTag}`}
                    >
                      {REF_KIND_LABEL[ref.kind]}
                    </span>
                    <span className="truncate">{sub}</span>
                  </span>
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(ref.id)}
                    className={`flex size-6 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 ${t.btn}`}
                    aria-label="Remove link"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className={`flex flex-col gap-1.5 rounded-lg border p-2 ${t.border} ${t.surfaceMuted}`}
        >
          <div className="flex items-center gap-1.5">
            <LinkIcon className={`size-3.5 shrink-0 ${t.textSubtle}`} />
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
              className={`flex h-8 items-center justify-center rounded-md px-2.5 text-[11px] disabled:opacity-50 ${t.accent}`}
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
          <p className={`px-1 text-[10px] ${t.textSubtle}`}>
            Kind is auto-detected: GitHub PRs / issues / commits, Google Docs,
            Notion, Figma, `.md` files, anything else as a link.
          </p>
        </form>
      )}
    </div>
  )
}

// Read view for the handoff content attached to a task. Pulls the row
// lazily when the task detail opens; renders the seven fields with a tiny
// "Open" button to launch the editor sheet for updates. Used both before
// and after a task is marked Done so the next person can read it inline.
function HandoffReadView({
  taskId,
  canEdit,
  onOpenEditor
}: {
  taskId: string
  canEdit: boolean
  onOpenEditor: () => void
}) {
  const { t } = useDashTheme()
  const [loading, setLoading] = useState(true)
  const [handoff, setHandoff] = useState<HandoffFieldValues | null>(null)

  // Reset loading on taskId change during render (avoids setState in effect).
  const [prevTaskId, setPrevTaskId] = useState(taskId)
  if (prevTaskId !== taskId) {
    setPrevTaskId(taskId)
    setLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    fetchTaskHandoff(taskId)
      .then((res) => {
        if (cancelled) return
        if ('error' in res) {
          setHandoff(null)
          return
        }
        setHandoff(res.handoff ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  const filled = handoff
    ? HANDOFF_FIELDS.filter((f) => (handoff[f] ?? '').trim().length > 0).length
    : 0
  const hasAny = filled > 0
  const total = HANDOFF_FIELDS.length

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
        >
          <Briefcase className="size-3" />
          Handoff {hasAny && `(${filled}/${total})`}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onOpenEditor}
            className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
          >
            <Pencil className="size-3" />
            {hasAny ? 'Edit' : 'Start'}
          </button>
        )}
      </div>

      {loading ? (
        <div
          className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] ${t.border} ${t.textSubtle}`}
        >
          <Loader2 className="size-3 animate-spin" />
          Loading…
        </div>
      ) : !hasAny ? (
        <div
          className={`rounded-md border border-dashed px-3 py-2 text-[11px] italic ${t.border} ${t.textSubtle}`}
        >
          No handoff written yet. Start one so the next person can pick this
          task up cleanly.
        </div>
      ) : (
        <dl
          className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 ${t.column}`}
        >
          {HANDOFF_FIELDS.map((field) => {
            const value = handoff?.[field] ?? ''
            const isEmpty = value.trim().length === 0
            return (
              <div key={field} className="flex flex-col gap-0.5">
                <dt
                  className={`text-[10px] tracking-wider uppercase ${
                    isEmpty ? t.textFaint : t.textMuted
                  }`}
                >
                  {HANDOFF_FIELD_LABELS[field]}
                </dt>
                <dd
                  className={`text-xs leading-snug whitespace-pre-wrap ${
                    isEmpty ? `italic ${t.textSubtle}` : t.text
                  }`}
                >
                  {isEmpty ? 'missing' : value}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}
