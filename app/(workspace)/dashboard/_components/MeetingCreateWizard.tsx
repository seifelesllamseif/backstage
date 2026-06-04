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
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  Trash2,
  Users,
  X as XIcon
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Avatar from './Avatar'
import { useTeam } from './TeamContext'
import { useDashTheme } from './theme'
import { createMeetingRequest } from '../actions'
import type { BoardTask } from './boardData'
import { formatTzDiff, formatTimeIn } from '@/lib/timezone'
import {
  MEETING_BRIEF_FIELD_HINTS,
  MEETING_BRIEF_FIELD_LABELS
} from '@/lib/meetingBrief'

// Step-by-step alternative to MeetingRequestSheet. Same underlying
// createMeetingRequest action; this one is for the Meetings page
// "New meeting" entry point where the user isn't starting from a
// specific teammate.
//
// Steps:
//   1. Attendees - who's invited
//   2. Topic - title + structured brief (goal/context/questions/pre-read)
//   3. When - mode toggle + date/slots/locked time
//   4. Review - read-only summary, send button

const DURATIONS = [15, 30, 45, 60, 90] as const

interface Ctx {
  open: () => void
}

const WizardCtx = createContext<Ctx | null>(null)

export function useMeetingCreateWizard(): Ctx {
  const ctx = useContext(WizardCtx)
  if (!ctx) throw new Error('useMeetingCreateWizard outside provider')
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
  d.setSeconds(0, 0)
  d.setHours(d.getHours() + hours)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Step = 1 | 2 | 3 | 4

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: 'Attendees' },
  { id: 2, label: 'Topic & brief' },
  { id: 3, label: 'When' },
  { id: 4, label: 'Review' }
]

export function MeetingCreateWizardProvider({
  currentUserId,
  tasks,
  children
}: {
  currentUserId: string
  tasks: BoardTask[]
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const viewerTz =
    team.find((m) => m.id === currentUserId)?.timezone ?? null
  const queryClient = useQueryClient()
  const [openSheet, setOpenSheet] = useState(false)
  const [step, setStep] = useState<Step>(1)

  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [questions, setQuestions] = useState('')
  const [preRead, setPreRead] = useState('')
  const [durationMin, setDurationMin] = useState<(typeof DURATIONS)[number]>(30)
  const [mode, setMode] = useState<'day' | 'slots'>('day')
  const [proposedDate, setProposedDate] = useState<string>(() => dateOffset(1))
  const [slots, setSlots] = useState<string[]>(() => [
    datetimeLocalOffset(24),
    datetimeLocalOffset(48)
  ])
  const [groupTime, setGroupTime] = useState<string>(() =>
    datetimeLocalOffset(24)
  )
  const [submitting, startSubmit] = useTransition()

  const isGroup = attendeeIds.length >= 2
  const today = useMemo(() => dateOffset(0), [])

  const open = useCallback(() => {
    // Fresh state on every open.
    setStep(1)
    setAttendeeIds([])
    setLinkedTaskId(null)
    setTitle('')
    setAgenda('')
    setGoal('')
    setContext('')
    setQuestions('')
    setPreRead('')
    setDurationMin(30)
    setMode('day')
    setProposedDate(dateOffset(1))
    setSlots([datetimeLocalOffset(24), datetimeLocalOffset(48)])
    setGroupTime(datetimeLocalOffset(24))
    setOpenSheet(true)
  }, [])

  const canProceed = useMemo(() => {
    if (step === 1) return attendeeIds.length > 0
    if (step === 2) return title.trim().length > 0
    if (step === 3) {
      if (isGroup) {
        return groupTime.length > 0 && !Number.isNaN(new Date(groupTime).getTime())
      }
      if (mode === 'day') {
        if (!proposedDate || !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) return false
        return proposedDate >= today
      }
      if (slots.length < 2) return false
      return slots.every((s) => s && !Number.isNaN(new Date(s).getTime()))
    }
    return true
  }, [
    step,
    attendeeIds.length,
    title,
    isGroup,
    groupTime,
    mode,
    proposedDate,
    slots,
    today
  ])

  function next() {
    if (!canProceed) return
    if (step < 4) setStep(((step + 1) as Step))
  }
  function back() {
    if (step > 1) setStep(((step - 1) as Step))
  }

  function submit() {
    if (!canProceed) return
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
        linkedTaskId
      }
      const payload = isGroup
        ? {
            ...baseFields,
            mode: 'slots' as const,
            slots: [new Date(groupTime).toISOString()]
          }
        : mode === 'day'
          ? { ...baseFields, mode: 'day' as const, proposedDate }
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
      setOpenSheet(false)
    })
  }

  return (
    <WizardCtx.Provider value={{ open }}>
      {children}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          className={`w-full p-0 sm:max-w-[36rem]! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>Request a meeting</SheetTitle>
          </VisuallyHidden.Root>

          <div className="flex h-full flex-col">
            <div className={`border-b px-5 pt-5 pb-3 ${t.border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${t.text}`}>
                  Request a meeting
                </span>
                <button
                  type="button"
                  onClick={() => setOpenSheet(false)}
                  className={`text-[11px] ${t.textMuted} hover:underline`}
                >
                  Cancel
                </button>
              </div>
              <Stepper current={step} />
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
              {step === 1 && (
                <StepAttendees
                  currentUserId={currentUserId}
                  viewerTz={viewerTz}
                  attendeeIds={attendeeIds}
                  onChange={setAttendeeIds}
                />
              )}
              {step === 2 && (
                <StepTopic
                  title={title}
                  setTitle={setTitle}
                  agenda={agenda}
                  setAgenda={setAgenda}
                  goal={goal}
                  setGoal={setGoal}
                  context={context}
                  setContext={setContext}
                  questions={questions}
                  setQuestions={setQuestions}
                  preRead={preRead}
                  setPreRead={setPreRead}
                  tasks={tasks}
                  currentUserId={currentUserId}
                  attendeeIds={attendeeIds}
                  linkedTaskId={linkedTaskId}
                  setLinkedTaskId={setLinkedTaskId}
                />
              )}
              {step === 3 && (
                <StepWhen
                  isGroup={isGroup}
                  attendeeIds={attendeeIds}
                  viewerTz={viewerTz}
                  durationMin={durationMin}
                  setDurationMin={setDurationMin}
                  mode={mode}
                  setMode={setMode}
                  proposedDate={proposedDate}
                  setProposedDate={setProposedDate}
                  slots={slots}
                  setSlots={setSlots}
                  groupTime={groupTime}
                  setGroupTime={setGroupTime}
                  today={today}
                />
              )}
              {step === 4 && (
                <StepReview
                  team={team}
                  attendeeIds={attendeeIds}
                  title={title}
                  agenda={agenda}
                  goal={goal}
                  context={context}
                  questions={questions}
                  preRead={preRead}
                  durationMin={durationMin}
                  mode={isGroup ? 'group_locked' : mode}
                  proposedDate={proposedDate}
                  slots={slots}
                  groupTime={groupTime}
                  viewerTz={viewerTz}
                  linkedTask={
                    linkedTaskId
                      ? tasks.find((tk) => tk.id === linkedTaskId) ?? null
                      : null
                  }
                />
              )}
            </div>

            <div
              className={`flex items-center justify-between border-t px-5 py-3 ${t.border}`}
            >
              <button
                type="button"
                onClick={back}
                disabled={step === 1}
                className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] disabled:opacity-40 ${t.border} ${t.btn}`}
              >
                <ArrowLeft className="size-3" /> Back
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canProceed}
                  className={`inline-flex h-8 items-center gap-1 rounded-md px-3 text-[11px] disabled:opacity-40 ${t.accent}`}
                >
                  Next <ArrowRight className="size-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] disabled:opacity-40 ${t.accent}`}
                >
                  {submitting ? 'Sending...' : 'Send for approval'}
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </WizardCtx.Provider>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  const { t } = useDashTheme()
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const isCurrent = s.id === current
        const isDone = s.id < current
        return (
          <div key={s.id} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                isCurrent
                  ? 'bg-teal-600 text-white'
                  : isDone
                    ? 'bg-teal-500/20 text-teal-700'
                    : `${t.surfaceMuted} ${t.textMuted}`
              }`}
            >
              {isDone ? <CheckCircle2 className="size-3" /> : s.id}
            </span>
            <span
              className={`truncate text-[10px] tracking-wider uppercase ${
                isCurrent ? t.text : t.textMuted
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px flex-1 ${isDone ? 'bg-teal-500/40' : t.border}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: attendees ───────────────────────────────────────────────────

function StepAttendees({
  currentUserId,
  viewerTz,
  attendeeIds,
  onChange
}: {
  currentUserId: string
  viewerTz: string | null
  attendeeIds: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const candidates = team.filter(
    (m) =>
      m.id !== currentUserId &&
      m.activityStatus !== 'on_vacation' &&
      m.activityStatus !== 'left'
  )
  const [query, setQuery] = useState('')
  const filtered = candidates.filter(
    (m) =>
      !query.trim() ||
      m.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  function toggle(id: string) {
    if (attendeeIds.includes(id)) onChange(attendeeIds.filter((x) => x !== id))
    else onChange([...attendeeIds, id])
  }

  function addEveryone() {
    onChange(
      candidates
        .filter(
          (m) =>
            m.activityStatus !== 'on_vacation' && m.activityStatus !== 'left'
        )
        .map((m) => m.id)
    )
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className={`text-sm font-medium ${t.text}`}>Who are you meeting with?</h3>
        <p className={`mt-0.5 text-[11px] ${t.textMuted}`}>
          Pick one teammate for a 1:1, or several for a group. Members on
          vacation or who have left are hidden.
        </p>
      </div>

      {attendeeIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {attendeeIds.map((id) => {
            const m = team.find((x) => x.id === id)
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-0.5 text-[11px] ${t.border} ${t.surfaceMuted}`}
              >
                {m && <Avatar user={m} size={18} />}
                <span className={`${t.text} max-w-[160px] truncate`}>
                  {m?.name ?? 'Unknown'}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${m?.name ?? 'attendee'}`}
                  className={`flex size-4 items-center justify-center rounded-full ${t.textMuted} hover:bg-zinc-200/60`}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={clearAll}
            className={`text-[10px] ${t.textMuted} hover:underline`}
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teammates..."
          className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
        />
        <button
          type="button"
          onClick={addEveryone}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] ${t.border} ${t.btn}`}
        >
          <Users className="size-3" /> Everyone
        </button>
      </div>

      <div
        className={`flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border p-1 ${t.border}`}
      >
        {filtered.length === 0 && (
          <p className={`px-2 py-3 text-[11px] italic ${t.textSubtle}`}>
            No teammates matched.
          </p>
        )}
        {filtered.map((m) => {
          const checked = attendeeIds.includes(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition ${
                checked ? 'bg-teal-500/10' : 'hover:bg-zinc-100/60'
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : t.border
                }`}
              >
                {checked && <CheckCircle2 className="size-2.5" />}
              </span>
              <Avatar user={m} size={20} />
              <span className={`flex-1 truncate ${t.text}`}>{m.name}</span>
              {m.timezone && (
                <span
                  className={`text-[9px] tracking-wider tabular-nums ${t.textSubtle}`}
                  title={m.timezone}
                >
                  {formatTzDiff(new Date(), viewerTz, m.timezone) ?? m.timezone}
                </span>
              )}
              {m.activityStatus && m.activityStatus !== 'active' && (
                <span className={`text-[10px] ${t.textSubtle}`}>
                  {m.activityStatus.replace('_', ' ')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 2: topic & brief ───────────────────────────────────────────────

function StepTopic({
  title,
  setTitle,
  agenda,
  setAgenda,
  goal,
  setGoal,
  context,
  setContext,
  questions,
  setQuestions,
  preRead,
  setPreRead,
  tasks,
  currentUserId,
  attendeeIds,
  linkedTaskId,
  setLinkedTaskId
}: {
  title: string
  setTitle: (v: string) => void
  agenda: string
  setAgenda: (v: string) => void
  goal: string
  setGoal: (v: string) => void
  context: string
  setContext: (v: string) => void
  questions: string
  setQuestions: (v: string) => void
  preRead: string
  setPreRead: (v: string) => void
  tasks: BoardTask[]
  currentUserId: string
  attendeeIds: string[]
  linkedTaskId: string | null
  setLinkedTaskId: (v: string | null) => void
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={`text-sm font-medium ${t.text}`}>
            What&apos;s this meeting about?
          </h3>
          <p className={`mt-0.5 text-[11px] ${t.textMuted}`}>
            Only a title is required; the brief is optional but helps
            attendees walk in prepared.
          </p>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
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

      {(['goal', 'context', 'questions'] as const).map((f) => {
        const value =
          f === 'goal' ? goal : f === 'context' ? context : questions
        const setter =
          f === 'goal' ? setGoal : f === 'context' ? setContext : setQuestions
        return (
          <label key={f} className="flex flex-col gap-1">
            <span
              className={`flex items-center gap-1 text-[9px] tracking-wider uppercase ${t.textMuted}`}
            >
              {MEETING_BRIEF_FIELD_LABELS[f]}
            </span>
            <textarea
              value={value}
              onChange={(e) => setter(e.target.value)}
              rows={f === 'questions' ? 4 : 3}
              maxLength={f === 'goal' ? 2000 : 4000}
              className={`resize-none rounded-md border px-2 py-1.5 text-xs leading-relaxed ${t.input}`}
              placeholder={MEETING_BRIEF_FIELD_HINTS[f]}
            />
          </label>
        )
      })}

      <PreReadField value={preRead} onChange={setPreRead} />

      <TaskPickerField
        tasks={tasks}
        currentUserId={currentUserId}
        attendeeIds={attendeeIds}
        value={linkedTaskId}
        onChange={setLinkedTaskId}
      />

      <label className="flex flex-col gap-1">
        <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
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
    </div>
  )
}

// ─── Step 3: when ────────────────────────────────────────────────────────

function StepWhen({
  isGroup,
  attendeeIds,
  viewerTz,
  durationMin,
  setDurationMin,
  mode,
  setMode,
  proposedDate,
  setProposedDate,
  slots,
  setSlots,
  groupTime,
  setGroupTime,
  today
}: {
  isGroup: boolean
  attendeeIds: string[]
  viewerTz: string | null
  durationMin: (typeof DURATIONS)[number]
  setDurationMin: (n: (typeof DURATIONS)[number]) => void
  mode: 'day' | 'slots'
  setMode: (m: 'day' | 'slots') => void
  proposedDate: string
  setProposedDate: (s: string) => void
  slots: string[]
  setSlots: (s: string[]) => void
  groupTime: string
  setGroupTime: (s: string) => void
  today: string
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const attendees = attendeeIds
    .map((id) => team.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
  // Cross-TZ preview: render each proposed time in every attendee's
  // saved zone so the requester can see what they're asking of people.
  function previewFor(iso: string): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const withDistinctTz = attendees.filter(
      (a) => a.timezone && a.timezone !== viewerTz
    )
    if (withDistinctTz.length === 0) return null
    return withDistinctTz
      .map(
        (a) =>
          `${a.name.split(/\s+/)[0]}: ${formatTimeIn(d, a.timezone, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })}`
      )
      .join(' · ')
  }
  const attendeeCount = attendeeIds.length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className={`text-sm font-medium ${t.text}`}>When?</h3>
        <p className={`mt-0.5 text-[11px] ${t.textMuted}`}>
          {isGroup
            ? `Group meeting (${attendeeCount} attendees). Pick one specific time.`
            : 'Pick a day for the requestee to choose their preferred time, or propose specific times.'}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
          Duration
        </span>
        <select
          value={durationMin}
          onChange={(e) =>
            setDurationMin(Number(e.target.value) as (typeof DURATIONS)[number])
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
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
            Mode
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
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
            Locked time
          </span>
          <input
            type="datetime-local"
            value={groupTime}
            onChange={(e) => setGroupTime(e.target.value)}
            className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
          />
          {previewFor(groupTime) && (
            <span className={`text-[10px] ${t.textSubtle}`}>
              {previewFor(groupTime)}
            </span>
          )}
        </label>
      ) : mode === 'day' ? (
        <label className="flex flex-col gap-1">
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
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
            The requestee will pick the time on this day.
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
              onClick={() => {
                if (slots.length >= 3) return
                setSlots([
                  ...slots,
                  datetimeLocalOffset(24 * (slots.length + 1))
                ])
              }}
              disabled={slots.length >= 3}
              className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition disabled:opacity-40 ${t.border} ${t.btn}`}
            >
              <Plus className="size-3" /> Add slot
            </button>
          </div>
          {slots.map((slot, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={slot}
                  onChange={(e) =>
                    setSlots(slots.map((s, idx) => (idx === i ? e.target.value : s)))
                  }
                  className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (slots.length <= 2) return
                    setSlots(slots.filter((_, idx) => idx !== i))
                  }}
                  disabled={slots.length <= 2}
                  aria-label={`Remove slot ${i + 1}`}
                  className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-40 ${t.border} ${t.btn}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              {previewFor(slot) && (
                <span className={`text-[10px] ${t.textSubtle}`}>
                  {previewFor(slot)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step 4: review ──────────────────────────────────────────────────────

function StepReview({
  team,
  attendeeIds,
  title,
  agenda,
  goal,
  context,
  questions,
  preRead,
  durationMin,
  mode,
  proposedDate,
  slots,
  groupTime,
  viewerTz,
  linkedTask
}: {
  team: ReturnType<typeof useTeam>
  attendeeIds: string[]
  title: string
  agenda: string
  goal: string
  context: string
  questions: string
  preRead: string
  durationMin: number
  mode: 'day' | 'slots' | 'group_locked'
  proposedDate: string
  slots: string[]
  groupTime: string
  linkedTask: BoardTask | null
  viewerTz: string | null
}) {
  const { t } = useDashTheme()
  const attendees = attendeeIds
    .map((id) => team.find((m) => m.id === id))
    .filter(Boolean)
  const fmtOpts = (extra: Intl.DateTimeFormatOptions) => ({
    ...extra,
    timeZone: viewerTz ?? undefined,
    timeZoneName: extra.hour ? ('short' as const) : undefined
  })
  const whenLabel = (() => {
    if (mode === 'group_locked') {
      const d = new Date(groupTime)
      return Number.isNaN(d.getTime())
        ? groupTime
        : new Intl.DateTimeFormat(
            'en-US',
            fmtOpts({
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })
          ).format(d)
    }
    if (mode === 'day') {
      const d = new Date(`${proposedDate}T12:00:00`)
      return Number.isNaN(d.getTime())
        ? proposedDate
        : new Intl.DateTimeFormat(
            'en-US',
            fmtOpts({
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })
          ).format(d) + ' (attendee picks time)'
    }
    return slots
      .map((s, i) => {
        const d = new Date(s)
        return Number.isNaN(d.getTime())
          ? `${i + 1}. ${s}`
          : `${i + 1}. ${new Intl.DateTimeFormat(
              'en-US',
              fmtOpts({
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })
            ).format(d)}`
      })
      .join('  ·  ')
  })()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className={`text-sm font-medium ${t.text}`}>Review</h3>
        <p className={`mt-0.5 text-[11px] ${t.textMuted}`}>
          One last look. The admin gets notified after you send.
        </p>
      </div>
      <ReviewRow label="With">
        <div className="flex flex-wrap items-center gap-1.5">
          {attendees.map((m) =>
            m ? (
              <span
                key={m.id}
                className={`inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px] ${t.border} ${t.surfaceMuted}`}
              >
                <Avatar user={m} size={18} />
                <span className={t.text}>{m.name}</span>
              </span>
            ) : null
          )}
        </div>
      </ReviewRow>
      <ReviewRow label="Title">
        <span className={`text-xs ${t.text}`}>{title}</span>
      </ReviewRow>
      <ReviewRow label="Duration">
        <span className={`text-xs ${t.text}`}>{durationMin} minutes</span>
      </ReviewRow>
      <ReviewRow label="When">
        <span className={`text-xs ${t.text}`}>{whenLabel}</span>
      </ReviewRow>
      <ReviewRow label="Goal">
        <span className={`text-xs whitespace-pre-wrap ${t.text}`}>{goal}</span>
      </ReviewRow>
      <ReviewRow label="Context">
        <span className={`text-xs whitespace-pre-wrap ${t.text}`}>
          {context}
        </span>
      </ReviewRow>
      <ReviewRow label="Questions">
        <span className={`text-xs whitespace-pre-wrap ${t.text}`}>
          {questions}
        </span>
      </ReviewRow>
      {linkedTask && (
        <ReviewRow label="Linked task">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] ${t.border} ${t.surfaceMuted}`}
          >
            <span className={`font-mono ${t.textMuted}`}>{linkedTask.ref}</span>
            <span className={`${t.text} max-w-[280px] truncate`}>
              {linkedTask.title}
            </span>
          </span>
        </ReviewRow>
      )}
      {splitPreReadLinks(preRead).length > 0 && (
        <ReviewRow label="Pre-read">
          <ul className="flex flex-col gap-1">
            {splitPreReadLinks(preRead).map((url, i) => (
              <li key={`${url}-${i}`} className="flex items-center gap-1.5">
                <LinkIcon className={`size-3 shrink-0 ${t.textMuted}`} />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`text-xs ${t.text} hover:underline`}
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </ReviewRow>
      )}
      {agenda.trim() && (
        <ReviewRow label="Internal note">
          <span className={`text-xs whitespace-pre-wrap ${t.text}`}>
            {agenda}
          </span>
        </ReviewRow>
      )}
    </div>
  )
}

// ─── Pre-read links input (shared with MeetingRequestSheet) ──────────────

// Stored on the server as a newline-joined string so the pre_read TEXT
// column doesn't need a schema change. Each line is one URL. We split
// on render and join on edit so the caller still passes a plain string
// in and gets a plain string out.
export function splitPreReadLinks(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function PreReadField({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useDashTheme()
  const [draft, setDraft] = useState('')
  const links = splitPreReadLinks(value)

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    // Tolerant about scheme - prepend https:// if the user didn't.
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    if (links.includes(url)) {
      setDraft('')
      return
    }
    onChange([...links, url].join('\n'))
    setDraft('')
  }

  function remove(i: number) {
    onChange(links.filter((_, idx) => idx !== i).join('\n'))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
        {MEETING_BRIEF_FIELD_LABELS.preRead}
      </span>

      {links.length > 0 && (
        <ul className="flex flex-col gap-1">
          {links.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${t.border}`}
            >
              <LinkIcon className={`size-3 shrink-0 ${t.textMuted}`} />
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className={`min-w-0 flex-1 truncate ${t.text} hover:underline`}
                title={url}
              >
                {url}
              </a>
              <ExternalLink className={`size-3 shrink-0 ${t.textSubtle}`} />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove link"
                className={`flex size-5 items-center justify-center rounded ${t.textMuted} hover:bg-zinc-200/60`}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draft)
            }
          }}
          placeholder="https://..."
          className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          disabled={!draft.trim()}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] transition disabled:opacity-40 ${t.border} ${t.btn}`}
        >
          <Plus className="size-3" /> Add
        </button>
      </div>
      <span className={`text-[10px] ${t.textSubtle}`}>
        {MEETING_BRIEF_FIELD_HINTS.preRead}
      </span>
    </div>
  )
}

// ─── Linked-task picker ──────────────────────────────────────────────────

function TaskPickerField({
  tasks,
  currentUserId,
  attendeeIds,
  value,
  onChange
}: {
  tasks: BoardTask[]
  currentUserId: string
  attendeeIds: string[]
  value: string | null
  onChange: (next: string | null) => void
}) {
  const { t } = useDashTheme()
  const [scope, setScope] = useState<'shared' | 'mine' | 'all'>('shared')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = value ? tasks.find((tk) => tk.id === value) ?? null : null

  // Tasks where the current user is a participant (assignee OR lead).
  // "Shared" narrows further to tasks where at least one selected
  // attendee is also on the task - the most likely meeting subject.
  const involves = (tk: BoardTask, memberId: string) =>
    tk.assignee?.id === memberId || tk.lead?.id === memberId

  const baseList = useMemo(() => {
    if (scope === 'all') return tasks
    const mine = tasks.filter((tk) => involves(tk, currentUserId))
    if (scope === 'mine' || attendeeIds.length === 0) return mine
    return mine.filter((tk) => attendeeIds.some((id) => involves(tk, id)))
  }, [tasks, scope, currentUserId, attendeeIds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? baseList.filter(
          (tk) =>
            tk.title.toLowerCase().includes(q) ||
            tk.ref.toLowerCase().includes(q)
        )
      : baseList
    return list.slice(0, 50)
  }, [baseList, query])

  const sharedDisabled = attendeeIds.length === 0

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
        Linked task (optional)
      </span>

      {selected ? (
        <div
          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${t.border}`}
        >
          <span className={`font-mono ${t.textMuted}`}>{selected.ref}</span>
          <span className={`min-w-0 flex-1 truncate ${t.text}`} title={selected.title}>
            {selected.title}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Unlink task"
            className={`flex size-5 items-center justify-center rounded ${t.textMuted} hover:bg-zinc-200/60`}
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ) : (
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex h-8 w-fit items-center gap-1 rounded-md border px-2 text-[11px] ${t.border} ${t.btn}`}
            >
              <Plus className="size-3" /> Link a task from your projects
            </button>
          ) : (
            <div className={`flex flex-col gap-2 rounded-md border p-2 ${t.border}`}>
              <div
                className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
              >
                <button
                  type="button"
                  onClick={() => setScope('shared')}
                  disabled={sharedDisabled}
                  title={
                    sharedDisabled ? 'Pick attendees first to see shared tasks.' : undefined
                  }
                  className={`flex-1 rounded px-2 py-1 text-[11px] transition disabled:opacity-40 ${
                    scope === 'shared' ? t.tabActive : t.tab
                  }`}
                >
                  Shared with attendees
                </button>
                <button
                  type="button"
                  onClick={() => setScope('mine')}
                  className={`flex-1 rounded px-2 py-1 text-[11px] transition ${scope === 'mine' ? t.tabActive : t.tab}`}
                >
                  My tasks
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex-1 rounded px-2 py-1 text-[11px] transition ${scope === 'all' ? t.tabActive : t.tab}`}
                >
                  All
                </button>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ref or title..."
                className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
              />
              <div
                className={`flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border p-1 ${t.border}`}
              >
                {filtered.length === 0 ? (
                  <p className={`px-2 py-2 text-[11px] italic ${t.textSubtle}`}>
                    No tasks match. Try a different scope.
                  </p>
                ) : (
                  filtered.map((tk) => (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => {
                        onChange(tk.id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition hover:bg-zinc-100/60`}
                    >
                      <span className={`font-mono ${t.textMuted}`}>{tk.ref}</span>
                      <span className={`min-w-0 flex-1 truncate ${t.text}`}>
                        {tk.title}
                      </span>
                      <span className={`text-[10px] ${t.textSubtle}`}>
                        {tk.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`self-end text-[10px] ${t.textMuted} hover:underline`}
              >
                Close
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReviewRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
        {label}
      </span>
      {children}
    </div>
  )
}
