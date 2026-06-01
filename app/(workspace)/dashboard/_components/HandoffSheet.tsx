'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitCommit,
  GitPullRequest,
  Link as LinkIcon,
  Loader2,
  MessageCircleQuestion,
  Plus,
  X
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import {
  HANDOFF_FIELDS,
  HANDOFF_FIELD_HINTS,
  HANDOFF_FIELD_LABELS,
  type HandoffField,
  type HandoffFieldValues
} from '@/lib/handoff'
import { defaultExternalRefLabel, parseExternalRef } from '@/lib/externalRef'
import {
  fetchTaskHandoff,
  saveHandoffDraft,
  submitHandoffForReview
} from '../actions'
import { useDashTheme } from './theme'
import type {
  BoardAssignee,
  TaskExternalRef,
  TaskExternalRefKind
} from './boardData'
import Avatar from './Avatar'

// Sheet that opens when the user tries to move a task to Done but the
// handoff gate blocks it (decision 0015). All 7 handoff fields render
// inline; on submit we upsert the handoff and move the task in one
// server call. Replaces the old "bounce to /projects/.../tasks/[id]"
// toast flow.

interface HandoffSheetProps {
  // The task we're trying to mark Done. null = closed.
  task: { id: string; ref: string; title: string } | null
  onClose: () => void
  // Called after a successful Done move so the parent can apply the
  // optimistic local update (matches the path it would have taken if the
  // gate had passed on the first try).
  onDone: (taskId: string) => void
  // External refs already attached to this task. The sheet renders them
  // inline so the user can verify links are in place before shipping,
  // and add new ones (PRs, docs, anything) without leaving the sheet.
  refs: TaskExternalRef[]
  onAddRef: (taskId: string, url: string) => void
  onRemoveRef: (taskId: string, refId: string) => void
  // Team members shown as toggleable chips in the "Who to ask" field.
  // The free-text fallback under the chips lets users add non-team
  // contacts (e.g. "Maryam (returning 1 June)").
  members: BoardAssignee[]
}

type FieldsState = Record<HandoffField, string>

const EMPTY_FIELDS: FieldsState = HANDOFF_FIELDS.reduce((acc, f) => {
  acc[f] = ''
  return acc
}, {} as FieldsState)

// Quick-pick suggestions for the "Current status" field. Picked from the
// answers a handoff usually needs: where the work physically lives + a
// few common stuck states. The user can still write anything; these just
// seed the textarea with a recognised label.
const STATUS_SUGGESTIONS = [
  'Production',
  'Staging',
  'Development',
  'Local',
  'In review',
  'Paused',
  'Blocked'
]

// localStorage-backed draft so a stray click-outside / Escape / browser
// refresh doesn't wipe whatever the user just typed. Keyed per task so
// drafts don't bleed across handoffs. Cleared on successful submit only.
const DRAFT_KEY_PREFIX = 'handoff-draft:'

function readDraft(taskId: string): Partial<FieldsState> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY_PREFIX + taskId)
    if (!raw) return null
    return JSON.parse(raw) as Partial<FieldsState>
  } catch {
    return null
  }
}

function writeDraft(taskId: string, fields: FieldsState) {
  if (typeof window === 'undefined') return
  try {
    // Only persist non-empty fields. Avoids overwriting a future reopen
    // with all-empty values just because the user briefly cleared the
    // sheet, and keeps the stored payload small.
    const trimmed: Partial<FieldsState> = {}
    for (const f of HANDOFF_FIELDS) {
      if (fields[f].trim().length > 0) trimmed[f] = fields[f]
    }
    const key = DRAFT_KEY_PREFIX + taskId
    if (Object.keys(trimmed).length === 0) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(trimmed))
    }
  } catch {
    // localStorage disabled / quota exceeded - silently ignore. Worst
    // case the user loses typing on close, which is the previous status
    // quo and not a regression.
  }
}

function clearDraft(taskId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DRAFT_KEY_PREFIX + taskId)
  } catch {
    // ignore
  }
}

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

// Splits the persisted "whoToAsk" string into the picked members (matched
// by name against the team) and any leftover free-text the user typed in.
// We treat any chunk that isn't a known team name as the fallback note,
// joined back with newlines so multi-line context survives a round-trip.
function splitWhoToAsk(
  raw: string,
  members: BoardAssignee[]
): { picked: Set<string>; extra: string } {
  const picked = new Set<string>()
  if (!raw.trim()) return { picked, extra: '' }
  const nameById = new Map(members.map((m) => [m.name.toLowerCase(), m.id]))
  const extras: string[] = []
  for (const rawLine of raw.split('\n')) {
    for (const chunk of rawLine.split(',')) {
      const trimmed = chunk.trim()
      if (!trimmed) continue
      const id = nameById.get(trimmed.toLowerCase())
      if (id) {
        picked.add(id)
      } else {
        extras.push(trimmed)
      }
    }
  }
  return { picked, extra: extras.join(', ') }
}

function joinWhoToAsk(
  picked: Set<string>,
  extra: string,
  members: BoardAssignee[]
): string {
  const names = members.filter((m) => picked.has(m.id)).map((m) => m.name)
  const extraTrimmed = extra.trim()
  if (extraTrimmed) names.push(extraTrimmed)
  return names.join(', ')
}

export default function HandoffSheet({
  task,
  onClose,
  onDone,
  refs,
  onAddRef,
  onRemoveRef,
  members
}: HandoffSheetProps) {
  const { t } = useDashTheme()
  const [fields, setFields] = useState<FieldsState>(EMPTY_FIELDS)
  const [loading, setLoading] = useState(false)
  const [submitting, startSubmit] = useTransition()
  const [savingDraft, startSaveDraft] = useTransition()
  const [missing, setMissing] = useState<Set<HandoffField>>(new Set())
  // Inline add-link state. Mirrors the LinksSection pattern in TaskDetail.
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkErr, setLinkErr] = useState<string | null>(null)

  // Reset state during render when the task prop changes (React-recommended
  // pattern to avoid synchronous setState inside an effect).
  const [prevTask, setPrevTask] = useState(task)
  if (prevTask !== task) {
    setPrevTask(task)
    if (!task) {
      setFields(EMPTY_FIELDS)
      setMissing(new Set())
    } else {
      setLoading(true)
    }
  }

  // Load the existing handoff row when the sheet opens, so we don't make
  // the user retype anything they already filled in via the task edit page.
  // Any in-progress localStorage draft from a prior aborted edit is layered
  // on top - drafted fields win over the server value so the user resumes
  // exactly where they left off.
  useEffect(() => {
    if (!task) {
      return
    }
    let cancelled = false
    fetchTaskHandoff(task.id)
      .then((res) => {
        if (cancelled) return
        if ('error' in res) {
          toast.error(res.error)
          return
        }
        const next: FieldsState = { ...EMPTY_FIELDS }
        if (res.handoff) {
          for (const f of HANDOFF_FIELDS) {
            next[f] = (res.handoff as HandoffFieldValues)[f] ?? ''
          }
        }
        const draft = readDraft(task.id)
        if (draft) {
          for (const f of HANDOFF_FIELDS) {
            const d = draft[f]
            if (typeof d === 'string' && d.trim().length > 0) {
              next[f] = d
            }
          }
        }
        setFields(next)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [task])

  // Persist the current field state as a draft on every change. Cheap
  // synchronous write; runs after the seeding effect so we never overwrite
  // a freshly-loaded server state with EMPTY_FIELDS.
  useEffect(() => {
    if (!task || loading) return
    writeDraft(task.id, fields)
  }, [task, fields, loading])

  const filledCount = HANDOFF_FIELDS.filter(
    (f) => fields[f].trim().length > 0
  ).length
  const totalCount = HANDOFF_FIELDS.length
  const allFilled = filledCount === totalCount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return
    // Client-side guard first so users see missing chips highlight without
    // a round trip.
    const nextMissing = new Set<HandoffField>()
    for (const field of HANDOFF_FIELDS) {
      if (fields[field].trim().length === 0) nextMissing.add(field)
    }
    if (nextMissing.size > 0) {
      setMissing(nextMissing)
      toast.error(
        `${nextMissing.size} field${nextMissing.size === 1 ? '' : 's'} still missing.`
      )
      return
    }
    setMissing(new Set())
    startSubmit(async () => {
      const payload: Partial<Record<HandoffField, string>> = {}
      for (const f of HANDOFF_FIELDS) payload[f] = fields[f].trim()
      const res = await submitHandoffForReview({
        taskId: task.id,
        fields: payload
      })
      if ('error' in res) {
        toast.error(res.error)
        if (res.missing && res.missing.length > 0) {
          setMissing(new Set(res.missing as HandoffField[]))
        }
        return
      }
      // Task status is intentionally left untouched - the member moves
      // the card to In review themselves once they're ready.
      toast.success(`${task.ref} handoff ready. Move it to In review when you're set.`)
      clearDraft(task.id)
      onDone(task.id)
      onClose()
    })
  }

  const handleSaveDraft = () => {
    if (!task) return
    setMissing(new Set())
    startSaveDraft(async () => {
      const payload: Partial<Record<HandoffField, string>> = {}
      for (const f of HANDOFF_FIELDS) payload[f] = fields[f].trim()
      const res = await saveHandoffDraft({
        taskId: task.id,
        fields: payload
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Draft saved.')
      clearDraft(task.id)
      onClose()
    })
  }

  return (
    <Sheet
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className={`w-full p-0 sm:max-w-160! ${t.detail}`}
      >
        <VisuallyHidden.Root>
          <SheetTitle>
            {task ? `Handoff for ${task.ref}` : 'Handoff'}
          </SheetTitle>
        </VisuallyHidden.Root>

        {task && (
          <form
            onSubmit={handleSubmit}
            className={`flex h-full flex-col ${t.detail}`}
          >
            <header
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3 ${t.border}`}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-[0.22em] uppercase tabular-nums ${t.metaTag}`}
                  >
                    {task.ref}
                  </span>
                  <span
                    className={`text-[10px] tracking-[0.22em] uppercase ${t.textSubtle}`}
                  >
                    Handoff required to mark Done
                  </span>
                </div>
                <h2 className={`truncate text-base font-medium ${t.text}`}>
                  {task.title}
                </h2>
              </div>
              <div
                className={`flex shrink-0 items-center gap-2 text-[11px] ${
                  allFilled ? 'text-teal-600 dark:text-teal-300' : t.textMuted
                }`}
              >
                {allFilled ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <span className="tabular-nums">
                    {filledCount}/{totalCount}
                  </span>
                )}
                <span className="hidden sm:inline">
                  {allFilled ? 'Ready' : 'fields filled'}
                </span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className={`mb-4 text-xs leading-relaxed ${t.textMuted}`}>
                Done isn&apos;t just a column move. The next person needs
                context to keep going. Fill the seven prompts below, then submit
                to ship the task. Anything you saved earlier from the task edit
                page is pre-filled.
              </p>

              {loading ? (
                <div
                  className={`flex items-center justify-center gap-2 py-10 text-xs ${t.textMuted}`}
                >
                  <Loader2 className="size-4 animate-spin" />
                  Loading handoff…
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Links section: attached PRs / issues / docs that ship
                      with the handoff. Auto-detects kind via lib/externalRef
                      so paste-and-go works (GitHub PR, Google Doc, etc.). */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
                      >
                        Links {refs.length > 0 && `(${refs.length})`}
                      </span>
                      {!addingLink && (
                        <button
                          type="button"
                          onClick={() => setAddingLink(true)}
                          className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
                        >
                          <Plus className="size-3" /> Add link
                        </button>
                      )}
                    </div>
                    {refs.length === 0 && !addingLink && (
                      <p className={`text-[11px] italic ${t.textSubtle}`}>
                        Attach a PR, Google Doc, Figma, or any URL the next
                        person needs.
                      </p>
                    )}
                    {refs.length > 0 && (
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
                              <Icon
                                className={`size-3.5 shrink-0 ${t.textMuted}`}
                              />
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${t.text}`}
                                title={ref.url}
                              >
                                <span className="truncate">{label}</span>
                                <ExternalLink
                                  className={`size-3 shrink-0 ${t.textSubtle}`}
                                />
                              </a>
                              <button
                                type="button"
                                onClick={() => onRemoveRef(task.id, ref.id)}
                                className={`flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
                                aria-label="Remove link"
                              >
                                <X className="size-3" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {addingLink && (
                      <div
                        className={`flex flex-col gap-1.5 rounded-md border p-2 ${t.border} ${t.surfaceMuted}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <LinkIcon
                            className={`size-3.5 shrink-0 ${t.textSubtle}`}
                          />
                          <input
                            autoFocus
                            type="url"
                            value={linkUrl}
                            onChange={(e) => {
                              setLinkUrl(e.target.value)
                              if (linkErr) setLinkErr(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setLinkUrl('')
                                setLinkErr(null)
                                setAddingLink(false)
                              }
                            }}
                            placeholder="Paste a PR, Google Doc, or any URL…"
                            className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = linkUrl.trim()
                              if (!trimmed) return
                              const parsed = parseExternalRef(trimmed)
                              if (!parsed) {
                                setLinkErr('Not a valid URL.')
                                return
                              }
                              onAddRef(task.id, parsed.url)
                              setLinkUrl('')
                              setLinkErr(null)
                              setAddingLink(false)
                            }}
                            disabled={!linkUrl.trim()}
                            className={`flex h-8 items-center justify-center rounded-md px-2.5 text-[11px] disabled:opacity-50 ${t.accent}`}
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkUrl('')
                              setLinkErr(null)
                              setAddingLink(false)
                            }}
                            className={`flex size-8 items-center justify-center rounded-md border ${t.btn}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        {linkErr && (
                          <p className="text-[11px] text-red-500">{linkErr}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`-mx-5 border-t px-5 pt-3 ${t.border}`}></div>
                  {HANDOFF_FIELDS.map((field) => {
                    const isMissing = missing.has(field)
                    const labelHeader = (
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-xs font-medium ${
                            isMissing
                              ? 'text-red-600 dark:text-red-300'
                              : t.text
                          }`}
                        >
                          {HANDOFF_FIELD_LABELS[field]}
                          {isMissing && (
                            <span className="ml-1 text-red-500">·</span>
                          )}
                        </span>
                        <span className={`text-[10px] ${t.textSubtle}`}>
                          {HANDOFF_FIELD_HINTS[field]}
                        </span>
                      </span>
                    )

                    // "Current status" renders the default textarea with a
                    // row of quick-pick environment chips on top. Click a
                    // chip to seed the textarea with that label (e.g.
                    // "Production", "Local"); free-text after that is up to
                    // the user. Active chip is detected by case-insensitive
                    // prefix match so "Production - deployed" still shows
                    // the Production chip lit.
                    if (field === 'currentStatus') {
                      const value = fields[field]
                      const setValue = (next: string) => {
                        setFields((cur) => ({ ...cur, [field]: next }))
                        if (isMissing && next.trim().length > 0) {
                          setMissing((cur) => {
                            const set = new Set(cur)
                            set.delete(field)
                            return set
                          })
                        }
                      }
                      return (
                        <div key={field} className="flex flex-col gap-1.5">
                          {labelHeader}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {STATUS_SUGGESTIONS.map((s) => {
                              const active = value
                                .trim()
                                .toLowerCase()
                                .startsWith(s.toLowerCase())
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setValue(s)}
                                  className={`flex h-6 items-center rounded-full border px-2 text-[11px] transition ${
                                    active ? t.chipActive : t.chip
                                  }`}
                                >
                                  {s}
                                </button>
                              )
                            })}
                          </div>
                          <textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            rows={2}
                            className={`resize-y rounded-md border px-3 py-2 text-xs leading-relaxed ${t.input} ${
                              isMissing
                                ? 'border-red-400 dark:border-red-400/60'
                                : ''
                            }`}
                            placeholder={HANDOFF_FIELD_HINTS[field]}
                          />
                        </div>
                      )
                    }

                    // The "Who to ask" field renders as a team-member chip
                    // picker on top + an optional free-text input below for
                    // non-team contacts. The persisted value is a comma-
                    // joined list of names, so storage stays a single
                    // string while UX is structured.
                    if (field === 'whoToAsk') {
                      const { picked, extra } = splitWhoToAsk(
                        fields[field],
                        members
                      )
                      const update = (
                        nextPicked: Set<string>,
                        nextExtra: string
                      ) => {
                        const joined = joinWhoToAsk(
                          nextPicked,
                          nextExtra,
                          members
                        )
                        setFields((cur) => ({ ...cur, [field]: joined }))
                        if (isMissing && joined.trim().length > 0) {
                          setMissing((cur) => {
                            const next = new Set(cur)
                            next.delete(field)
                            return next
                          })
                        }
                      }
                      return (
                        <div key={field} className="flex flex-col gap-1.5">
                          {labelHeader}
                          <div
                            className={`flex flex-col gap-2 rounded-md border px-2 py-2 ${t.input} ${
                              isMissing
                                ? 'border-red-400 dark:border-red-400/60'
                                : ''
                            }`}
                          >
                            {members.length === 0 ? (
                              <p
                                className={`text-[10px] italic ${t.textSubtle}`}
                              >
                                No teammates available yet.
                              </p>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {members.map((m) => {
                                  const on = picked.has(m.id)
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(picked)
                                        if (next.has(m.id)) next.delete(m.id)
                                        else next.add(m.id)
                                        update(next, extra)
                                      }}
                                      className={`flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px] transition ${
                                        on ? t.chipActive : t.chip
                                      }`}
                                    >
                                      <Avatar user={m} size={16} />
                                      <span className="max-w-30 truncate">
                                        {m.name}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            <input
                              type="text"
                              value={extra}
                              onChange={(e) => update(picked, e.target.value)}
                              placeholder="Add anyone else (off-team contact, role, etc.)"
                              className={`h-7 rounded-sm border-none bg-transparent px-1 text-[11px] outline-none ${t.textMuted} placeholder:${t.textFaint}`}
                            />
                          </div>
                        </div>
                      )
                    }

                    return (
                      <label key={field} className="flex flex-col gap-1">
                        {labelHeader}
                        <textarea
                          value={fields[field]}
                          onChange={(e) => {
                            setFields((cur) => ({
                              ...cur,
                              [field]: e.target.value
                            }))
                            if (isMissing && e.target.value.trim().length > 0) {
                              setMissing((cur) => {
                                const next = new Set(cur)
                                next.delete(field)
                                return next
                              })
                            }
                          }}
                          rows={
                            field === 'whatItIs' || field === 'doneSoFar'
                              ? 3
                              : 2
                          }
                          className={`resize-y rounded-md border px-3 py-2 text-xs leading-relaxed ${t.input} ${
                            isMissing
                              ? 'border-red-400 dark:border-red-400/60'
                              : ''
                          }`}
                          placeholder={HANDOFF_FIELD_HINTS[field]}
                        />
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <footer
              className={`flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3 ${t.border}`}
            >
              <span className={`text-[11px] ${t.textMuted}`}>
                {allFilled
                  ? 'All seven prompts filled. Ready to send to review.'
                  : `${totalCount - filledCount} field${
                      totalCount - filledCount === 1 ? '' : 's'
                    } to go before this can be sent to review. Save a draft anytime.`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-8 items-center rounded-md border px-3 text-xs transition ${t.btn}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft || submitting || loading}
                  className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition disabled:opacity-50 ${t.btn}`}
                >
                  {savingDraft ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save draft'
                  )}
                </button>
                <button
                  type="submit"
                  disabled={submitting || savingDraft || loading || !allFilled}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.accent}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Send to review
                    </>
                  )}
                </button>
              </div>
            </footer>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
