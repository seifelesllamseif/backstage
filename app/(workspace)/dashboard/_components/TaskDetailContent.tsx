'use client'

import { useState } from 'react'
import { X, MessageSquare, Paperclip, GitBranch } from 'lucide-react'
import { BoardTask } from './boardData'
import { useTeam } from './TeamContext'
import {
  STATUS_BY_ID,
  STATUSES,
  TaskStatus,
  TaskPriority,
  PRIORITY_LABEL,
  RELATION_LABEL
} from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import Avatar from './Avatar'
import MentionInput, { renderMentionedBody } from './MentionInput'
import { useDashTheme } from './theme'

export interface TaskCommentLite {
  id: string
  author: string
  body: string
  at: string
  mentions?: string[]
}

export interface TaskActivityLite {
  id: string
  kind: 'status' | 'comment' | 'attachment' | 'created' | 'priority' | 'assignee'
  text: string
  at: string
}

interface Props {
  task: BoardTask
  comments: TaskCommentLite[]
  activity: TaskActivityLite[]
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
  onChangeStatus: (id: string, s: TaskStatus) => void
  onChangePriority: (id: string, p: TaskPriority) => void
  onChangeAssignee: (id: string, assigneeId: string | null) => void
  onAddComment: (id: string, body: string, mentions?: string[]) => void
  showHeader?: boolean
  onClose?: () => void
  compact?: boolean
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function TaskDetailContent({
  task,
  comments,
  activity,
  currentUserId,
  accessTier,
  onChangeStatus,
  onChangePriority,
  onChangeAssignee,
  onAddComment,
  showHeader = true,
  onClose,
  compact = false
}: Props) {
  const { t } = useDashTheme()
  const team = useTeam()
  const isPlanner = accessTier === 'admin' || accessTier === 'lead'
  const isAssignee = task.assignee?.id === currentUserId
  const canEditPlanner = isPlanner
  const canEditOwner = isPlanner || isAssignee
  const [statusOpen, setStatusOpen] = useState(false)
  const [prioOpen, setPrioOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)

  const status = STATUS_BY_ID[task.status]

  return (
    <div className="flex flex-col gap-5">
      {showHeader && (
        <div
          className={`flex items-center justify-between pb-3 border-b ${t.border}`}
        >
          <span
            className={`text-[10px] uppercase tracking-[0.22em] ${t.textSubtle}`}
          >
            {task.ref}
          </span>
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className={`size-7 rounded-md flex items-center justify-center transition ${t.btn}`}
              aria-label="Close detail"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {!compact && (
        <h2 className={`text-lg font-medium leading-snug ${t.text}`}>
          {task.title}
        </h2>
      )}

      <div className="grid grid-cols-[88px_1fr] gap-y-2.5 text-xs items-center">
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
              onClick={(e) => {
                e.stopPropagation()
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
              onClick={(e) => {
                e.stopPropagation()
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
            onClick={(e) => {
              e.stopPropagation()
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
              onClick={(e) => {
                e.stopPropagation()
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
                  <span className={t.textMuted}>{RELATION_LABEL[r.kind]}</span>
                  <span
                    className={`uppercase tracking-wider text-[10px] ${t.text}`}
                  >
                    {r.ref}
                  </span>
                </span>
              ))}
            </span>
          </>
        )}

        {task.checklist && task.checklist.length > 0 && (
          <>
            <FieldLabel>Checklist</FieldLabel>
            <ul className="flex flex-col gap-1">
              {task.checklist.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-2 text-xs ${
                    c.done ? `${t.textSubtle} line-through` : t.text
                  }`}
                >
                  <span
                    className={`size-3.5 rounded-sm border flex items-center justify-center ${
                      c.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : t.border
                    }`}
                  >
                    {c.done && (
                      <svg
                        viewBox="0 0 16 16"
                        className="size-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 8.4 L6.8 11.4 L13 4.6" />
                      </svg>
                    )}
                  </span>
                  {c.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <div
          className={`text-[10px] uppercase tracking-[0.22em] mb-2 ${t.textMuted}`}
        >
          Comments ({comments.length})
        </div>
        <div className="flex flex-col gap-2">
          {comments.length === 0 && (
            <p className={`text-xs italic ${t.textSubtle}`}>No comments yet.</p>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border px-3 py-2 text-xs ${t.border} ${t.surfaceMuted}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-medium ${t.text}`}>{c.author}</span>
                <span className={`text-[10px] ${t.textSubtle}`}>{c.at}</span>
              </div>
              <p className={`${t.textMuted} leading-snug`}>
                {renderMentionedBody(c.body, team)}
              </p>
            </div>
          ))}
        </div>
        {canEditOwner ? (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <MentionInput
              accessTier={accessTier}
              onSubmit={(body, mentions) =>
                onAddComment(task.id, body, mentions)
              }
            />
          </div>
        ) : (
          <p className={`mt-3 text-[11px] italic ${t.textSubtle}`}>
            Only the assignee can comment on this task.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 text-xs">
        <div
          className={`text-[10px] uppercase tracking-[0.22em] ${t.textMuted}`}
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
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange(!open)
        }}
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
