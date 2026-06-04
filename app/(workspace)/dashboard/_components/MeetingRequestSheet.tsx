'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Plus, Trash2, Users, X as XIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Avatar from './Avatar'
import { useTeam } from './TeamContext'
import { formatTzDiff, formatTimeIn } from '@/lib/timezone'
import { useDashTheme } from './theme'
import { createMeetingRequest } from '../actions'
import { PreReadField } from './MeetingCreateWizard'
import {
  MEETING_BRIEF_FIELDS,
  MEETING_BRIEF_FIELD_HINTS,
  MEETING_BRIEF_FIELD_LABELS,
  countMissingBriefFields,
  type MeetingBriefValues
} from '@/lib/meetingBrief'

// Sheet that lets a member submit a meeting request against another
// teammate. Two modes:
//   - 'day':   requester picks one date. Requestee picks the time later.
//   - 'slots': requester proposes 2-3 specific datetimes. Requestee
//              picks one.
//
// Wave 1.A: a handoff-style brief is mandatory at submit. Three required
// fields (goal/context/questions) + one optional (preRead) + an editable
// "linked task" chip when opened from a TaskDetail entry point.

const DURATIONS = [15, 30, 45, 60, 90] as const

interface PrefillArgs {
  title?: string
  linkedTaskId?: string
  linkedTaskRef?: string
  linkedTaskTitle?: string
}

interface OpenArgs {
  memberId: string
  // Optional pre-populated extra attendees. The primary memberId is
  // always the first chip; this lets a caller open the sheet for a
  // group (e.g. "request 1:N from this task").
  additionalMemberIds?: string[]
  prefill?: PrefillArgs
}

interface Ctx {
  open: (args: OpenArgs) => void
}

const MeetingRequestCtx = createContext<Ctx | null>(null)

export function useMeetingRequestSheet(): Ctx {
  const ctx = useContext(MeetingRequestCtx)
  if (!ctx) throw new Error('useMeetingRequestSheet outside provider')
  return ctx
}

function dateOffset(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function datetimeLocalOffset(hours: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30 - (d.getMinutes() % 30))
  d.setSeconds(0)
  d.setMilliseconds(0)
  d.setHours(d.getHours() + hours)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const draftKey = (requesteeId: string) => `meeting-draft:${requesteeId}`

export function MeetingRequestSheetProvider({
  currentUserId,
  children
}: {
  currentUserId: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const viewerTz =
    team.find((m) => m.id === currentUserId)?.timezone ?? null
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const [extraAttendees, setExtraAttendees] = useState<string[]>([])
  const [prefill, setPrefill] = useState<PrefillArgs | null>(null)
  const [linkedTask, setLinkedTask] = useState<{
    id: string
    ref: string | null
    title: string | null
  } | null>(null)
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [questions, setQuestions] = useState('')
  const [preRead, setPreRead] = useState('')
  const [durationMin, setDurationMin] = useState<(typeof DURATIONS)[number]>(30)
  const [mode, setMode] = useState<'day' | 'slots'>('day')
  const [proposedDate, setProposedDate] = useState<string>('')
  const [slots, setSlots] = useState<string[]>([])
  // Group meetings (2+ attendees) lock a single specific time. We keep
  // that input separate from the 1:1 slot-picker state so switching
  // group <-> 1:1 doesn't clobber the user's other inputs.
  const [groupTime, setGroupTime] = useState<string>('')
  const [submitting, startSubmit] = useTransition()

  const target = openId ? team.find((m) => m.id === openId) : null
  const attendeeIds = useMemo(
    () => (openId ? [openId, ...extraAttendees] : []),
    [openId, extraAttendees]
  )
  const isGroup = attendeeIds.length >= 2

  const open = useCallback((args: OpenArgs) => {
    setOpenId(args.memberId)
    setExtraAttendees((args.additionalMemberIds ?? []).filter((id) => id !== args.memberId))
    setPrefill(args.prefill ?? null)
  }, [])

  // Reset state each time the sheet opens. Restore from localStorage
  // draft so a half-filled request survives an accidental close.
  useEffect(() => {
    if (!target) return
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(draftKey(target.id))
        : null
    let draft: {
      title?: string
      agenda?: string
      goal?: string
      context?: string
      questions?: string
      preRead?: string
      durationMin?: number
      mode?: 'day' | 'slots'
      proposedDate?: string
      slots?: string[]
    } | null = null
    if (stored) {
      try {
        draft = JSON.parse(stored)
      } catch {
        draft = null
      }
    }
    setTitle(prefill?.title ?? draft?.title ?? '')
    setAgenda(draft?.agenda ?? '')
    setGoal(draft?.goal ?? '')
    setContext(draft?.context ?? '')
    setQuestions(draft?.questions ?? '')
    setPreRead(draft?.preRead ?? '')
    setDurationMin(
      (draft?.durationMin as (typeof DURATIONS)[number]) ?? 30
    )
    setMode(draft?.mode ?? 'day')
    setProposedDate(draft?.proposedDate ?? dateOffset(1))
    setSlots(
      draft?.slots ?? [datetimeLocalOffset(24), datetimeLocalOffset(48)]
    )
    setGroupTime(datetimeLocalOffset(24))
    setLinkedTask(
      prefill?.linkedTaskId
        ? {
            id: prefill.linkedTaskId,
            ref: prefill.linkedTaskRef ?? null,
            title: prefill.linkedTaskTitle ?? null
          }
        : null
    )
  }, [target, prefill])

  // Persist a draft on every meaningful keystroke. Skipped while the
  // sheet is closed; cleared after a successful submit.
  useEffect(() => {
    if (!target) return
    if (typeof window === 'undefined') return
    const payload = {
      title,
      agenda,
      goal,
      context,
      questions,
      preRead,
      durationMin,
      mode,
      proposedDate,
      slots
    }
    window.localStorage.setItem(draftKey(target.id), JSON.stringify(payload))
  }, [
    target,
    title,
    agenda,
    goal,
    context,
    questions,
    preRead,
    durationMin,
    mode,
    proposedDate,
    slots
  ])

  const today = useMemo(() => dateOffset(0), [])

  const briefValues: MeetingBriefValues = useMemo(
    () => ({
      goal: goal.trim() || null,
      context: context.trim() || null,
      questions: questions.trim() || null,
      preRead: preRead.trim() || null
    }),
    [goal, context, questions, preRead]
  )

  const missingBrief = countMissingBriefFields(briefValues)
  const briefDone = missingBrief === 0

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (!briefDone) return false
    if (attendeeIds.length === 0) return false
    if (isGroup) {
      if (!groupTime) return false
      return !Number.isNaN(new Date(groupTime).getTime())
    }
    if (mode === 'day') {
      if (!proposedDate) return false
      if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) return false
      if (proposedDate < today) return false
      return true
    }
    if (slots.length < 2) return false
    return slots.every((s) => s && !Number.isNaN(new Date(s).getTime()))
  }, [
    title,
    briefDone,
    attendeeIds.length,
    isGroup,
    groupTime,
    mode,
    proposedDate,
    slots,
    today
  ])

  function addSlot() {
    if (slots.length >= 3) return
    setSlots([...slots, datetimeLocalOffset(24 * (slots.length + 1))])
  }

  function removeSlot(i: number) {
    if (slots.length <= 2) return
    setSlots(slots.filter((_, idx) => idx !== i))
  }

  function updateSlot(i: number, value: string) {
    setSlots(slots.map((s, idx) => (idx === i ? value : s)))
  }

  function submit() {
    if (!target) return
    if (!canSubmit) return
    startSubmit(async () => {
      const baseFields = {
        attendeeIds,
        title: title.trim(),
        agenda: agenda.trim() || null,
        durationMin,
        goal: goal.trim(),
        context: context.trim(),
        questions: questions.trim(),
        preRead: preRead.trim() || null,
        linkedTaskId: linkedTask?.id ?? null
      }
      const payload = isGroup
        ? {
            ...baseFields,
            mode: 'slots' as const,
            slots: [new Date(groupTime).toISOString()]
          }
        : mode === 'day'
          ? {
              ...baseFields,
              mode: 'day' as const,
              proposedDate
            }
          : {
              ...baseFields,
              mode: 'slots' as const,
              slots: slots.map((s) => new Date(s).toISOString())
            }
      const res = await createMeetingRequest(payload)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Meeting request sent for approval.')
      queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey(target.id))
      }
      setOpenId(null)
      setPrefill(null)
    })
  }

  return (
    <MeetingRequestCtx.Provider value={{ open }}>
      {children}
      <Sheet
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null)
            setPrefill(null)
          }
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          className={`w-full p-0 sm:max-w-120! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>
              {target ? `Request meeting with ${target.name}` : 'Request meeting'}
            </SheetTitle>
          </VisuallyHidden.Root>

          <div className="flex h-full flex-col">
            <div
              className={`flex flex-col gap-2 border-b px-4 py-3 ${t.border}`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`size-4 ${t.textMuted}`} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`text-xs leading-tight font-medium ${t.text}`}
                  >
                    Request meeting
                  </span>
                  <span className={`text-[11px] ${t.textMuted}`}>
                    {isGroup
                      ? `${attendeeIds.length} attendees`
                      : `with ${target?.name ?? ''}`}
                    {!isGroup && target?.timezone && (
                      <>
                        {' · '}
                        <span
                          className="tabular-nums"
                          title={target.timezone}
                        >
                          {formatTzDiff(
                            new Date(),
                            viewerTz,
                            target.timezone
                          ) ?? target.timezone}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                    briefDone
                      ? 'bg-teal-500/10 text-teal-700'
                      : `${t.surfaceMuted} ${t.textMuted}`
                  }`}
                >
                  {briefDone ? (
                    <>
                      <CheckCircle2 className="size-3" /> Brief ready
                    </>
                  ) : (
                    `${MEETING_BRIEF_FIELDS.length - missingBrief}/${MEETING_BRIEF_FIELDS.length} filled`
                  )}
                </span>
              </div>

              <AttendeePicker
                attendeeIds={attendeeIds}
                primaryId={openId}
                onRemove={(id) =>
                  setExtraAttendees(extraAttendees.filter((x) => x !== id))
                }
                onAdd={(id) => {
                  if (attendeeIds.includes(id)) return
                  setExtraAttendees([...extraAttendees, id])
                }}
                onAddEveryone={() => {
                  // Skip people who can't realistically attend right
                  // now: on vacation or left the company. They can
                  // still be added manually from the dropdown if the
                  // requester insists.
                  const everyoneElse = team
                    .filter(
                      (m) =>
                        m.id !== openId &&
                        m.activityStatus !== 'on_vacation' &&
                        m.activityStatus !== 'left'
                    )
                    .map((m) => m.id)
                  setExtraAttendees(everyoneElse)
                }}
              />
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {linkedTask && (
                <div
                  className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] ${t.border} ${t.surfaceMuted}`}
                >
                  <span className={`truncate ${t.text}`}>
                    Linked to{' '}
                    <strong>
                      {linkedTask.ref ?? linkedTask.id.slice(0, 6)}
                    </strong>
                    {linkedTask.title ? ` - ${linkedTask.title}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinkedTask(null)}
                    className={`text-[10px] ${t.textMuted} hover:underline`}
                  >
                    Unlink
                  </button>
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                  placeholder="What's this about?"
                />
              </label>

              {/* Brief section - mandatory at submit. */}
              {(['goal', 'context', 'questions'] as const).map((f) => {
                const value =
                  f === 'goal' ? goal : f === 'context' ? context : questions
                const setter =
                  f === 'goal'
                    ? setGoal
                    : f === 'context'
                      ? setContext
                      : setQuestions
                const isEmpty = !value.trim()
                return (
                  <label key={f} className="flex flex-col gap-1">
                    <span
                      className={`flex items-center gap-1 text-[9px] tracking-wider uppercase ${t.textMuted}`}
                    >
                      {MEETING_BRIEF_FIELD_LABELS[f]}
                      <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      rows={f === 'questions' ? 4 : 3}
                      maxLength={f === 'goal' ? 2000 : 4000}
                      className={`resize-none rounded-md border px-2 py-1.5 text-xs leading-relaxed ${t.input} ${isEmpty ? '' : ''}`}
                      placeholder={MEETING_BRIEF_FIELD_HINTS[f]}
                    />
                  </label>
                )
              })}

              <PreReadField value={preRead} onChange={setPreRead} />

              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Internal note (optional)
                </span>
                <textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className={`resize-none rounded-md border px-2 py-1.5 text-xs leading-relaxed ${t.input}`}
                  placeholder="Anything else you want the admin to see."
                />
              </label>

              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Duration
                </span>
                <select
                  value={durationMin}
                  onChange={(e) =>
                    setDurationMin(
                      Number(e.target.value) as (typeof DURATIONS)[number]
                    )
                  }
                  className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </label>

              {!isGroup && (
                <div className="flex flex-col gap-1">
                  <span
                    className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                  >
                    When
                  </span>
                  <div
                    className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
                  >
                    <button
                      type="button"
                      onClick={() => setMode('day')}
                      className={`flex-1 rounded px-2.5 py-1 text-xs transition ${mode === 'day' ? t.tabActive : t.tab}`}
                    >
                      Pick a day
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('slots')}
                      className={`flex-1 rounded px-2.5 py-1 text-xs transition ${mode === 'slots' ? t.tabActive : t.tab}`}
                    >
                      Propose 2-3 times
                    </button>
                  </div>
                </div>
              )}

              {isGroup ? (
                <label className="flex flex-col gap-1">
                  <span
                    className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                  >
                    When
                  </span>
                  <input
                    type="datetime-local"
                    value={groupTime}
                    onChange={(e) => setGroupTime(e.target.value)}
                    className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                  />
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    Group meetings need one locked time. Attendees can&apos;t
                    individually pick.
                  </span>
                </label>
              ) : mode === 'day' ? (
                <label className="flex flex-col gap-1">
                  <span
                    className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                  >
                    Day
                  </span>
                  <input
                    type="date"
                    value={proposedDate}
                    min={today}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                  />
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    The requestee picks the time on this day.
                  </span>
                </label>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                    >
                      Proposed slots ({slots.length}/3)
                    </span>
                    <button
                      type="button"
                      onClick={addSlot}
                      disabled={slots.length >= 3}
                      className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition disabled:opacity-40 ${t.border} ${t.btn}`}
                    >
                      <Plus className="size-3" /> Add slot
                    </button>
                  </div>
                  {slots.map((slot, i) => {
                    const targetPreview =
                      target?.timezone &&
                      target.timezone !== viewerTz &&
                      slot
                        ? formatTimeIn(new Date(slot), target.timezone, {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                          })
                        : null
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="datetime-local"
                            value={slot}
                            onChange={(e) => updateSlot(i, e.target.value)}
                            className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeSlot(i)}
                            disabled={slots.length <= 2}
                            aria-label={`Remove slot ${i + 1}`}
                            className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-40 ${t.border} ${t.btn}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                        {targetPreview && target && (
                          <span className={`text-[10px] ${t.textSubtle}`}>
                            {target.name.split(/\s+/)[0]}: {targetPreview}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    Times are in your local timezone. The requestee picks one.
                  </span>
                </div>
              )}
            </div>

            <div
              className={`flex items-center justify-end gap-2 border-t px-4 py-3 ${t.border}`}
            >
              <button
                onClick={() => {
                  setOpenId(null)
                  setPrefill(null)
                }}
                className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className={`h-7 rounded-md px-2.5 text-[11px] disabled:opacity-40 ${t.accent}`}
              >
                {submitting ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </MeetingRequestCtx.Provider>
  )
}

function AttendeePicker({
  attendeeIds,
  primaryId,
  onRemove,
  onAdd,
  onAddEveryone
}: {
  attendeeIds: string[]
  primaryId: string | null
  onRemove: (id: string) => void
  onAdd: (id: string) => void
  onAddEveryone: () => void
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const known = useMemo(
    () => new Map(team.map((m) => [m.id, m])),
    [team]
  )
  const addable = team.filter(
    (m) =>
      m.id !== primaryId &&
      !attendeeIds.includes(m.id) &&
      m.activityStatus !== 'on_vacation' &&
      m.activityStatus !== 'left'
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {attendeeIds.map((id) => {
        const m = known.get(id)
        const isPrimary = id === primaryId
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-0.5 text-[11px] ${t.border} ${t.surfaceMuted}`}
          >
            {m && <Avatar user={m} size={18} />}
            <span className={`${t.text} max-w-[140px] truncate`}>
              {m?.name ?? 'Unknown'}
            </span>
            {!isPrimary && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label={`Remove ${m?.name ?? 'attendee'}`}
                className={`flex size-4 items-center justify-center rounded-full ${t.textMuted} hover:bg-zinc-200/60`}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </span>
        )
      })}
      {addable.length > 0 && (
        <>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAdd(e.target.value)
            }}
            className={`h-6 rounded-md border px-1.5 text-[10px] ${t.input}`}
          >
            <option value="">+ Add attendee</option>
            {addable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAddEveryone}
            className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.border} ${t.btn}`}
          >
            Everyone
          </button>
        </>
      )}
    </div>
  )
}
