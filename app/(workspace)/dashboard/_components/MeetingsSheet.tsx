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
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Calendar,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Plus,
  X as XIcon
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import { useDashTheme } from './theme'
import { useTeam } from './TeamContext'
import { formatTimeIn } from '@/lib/timezone'
import {
  appendMeetingContext,
  approveMeetingRequest,
  cancelMeetingRequest,
  declineMeetingRequest,
  listMyMeetingRequests,
  listPendingApprovals,
  pickMeetingSlot,
  pickMeetingTime,
  rejectMeetingRequest,
  rescheduleMeetingRequest,
  resendMeetingNotification,
  submitMeetingReview
} from '../actions'

// Surfaces partial email-fanout failures as a follow-up toast so the
// user knows when Resend swallowed a notification.
type EmailStatus = {
  sent: number
  failures: { memberId: string; reason: string }[]
}
function notifyEmailStatus(emailStatus: EmailStatus | undefined): void {
  if (!emailStatus || emailStatus.failures.length === 0) return
  const count = emailStatus.failures.length
  const reason = emailStatus.failures[0]?.reason ?? 'unknown'
  toast.warning(
    `Action saved, but ${count} email${count === 1 ? '' : 's'} failed to send (${reason}).`,
    { description: 'Use "Resend email" on the card to try again.' }
  )
}

// Single sheet that surfaces meeting-request state, scoped to the
// current viewer's role:
//   - admin / lead: pending approvals + their own requests
//   - member: their own requests + meetings where they're the requestee

// `focus` narrows the sheet to a single subset so the Stats cards on
// the Meetings page can deep-link into one bucket instead of dumping
// the whole inbox. `undefined` keeps the full inbox view.
type FocusKey = 'pending' | 'awaiting' | 'scheduled' | 'review'

interface OpenArgs {
  focusedRequestId?: string
  focus?: FocusKey
}

interface Ctx {
  open: (args?: OpenArgs) => void
  pendingApprovalCount: number
  awaitingPickCount: number
}

const MeetingsCtx = createContext<Ctx | null>(null)

export function useMeetingsSheet(): Ctx {
  const ctx = useContext(MeetingsCtx)
  if (!ctx) throw new Error('useMeetingsSheet outside provider')
  return ctx
}

type MeetingOutcome = 'resolved' | 'partial' | 'needs_followup' | 'failed'

type MeetingRequestRow = {
  id: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'declined'
    | 'scheduled'
    | 'canceled'
    | 'completed'
  mode: 'day' | 'slots'
  title: string
  agenda: string | null
  durationMin: number
  proposedDate: string | null
  slots: string[] | null
  selectedStartsAt: string | null
  selectedSlotIndex: number | null
  meetLink: string | null
  calendarEventId: string | null
  requesterId: string
  requesterName: string
  attendees: {
    id: string
    fullName: string
    avatarUrl: string | null
    pickedAt: string | null
  }[]
  approvedById: string | null
  approvedAt: string | null
  rejectionReason: string | null
  declineReason: string | null
  goal: string | null
  context: string | null
  questions: string | null
  preRead: string | null
  requesteeContext: string | null
  linkedTaskIds: string[]
  outcome: MeetingOutcome | null
  reviewNotes: string | null
  reviewedAt: string | null
  reviewedById: string | null
  followUpMeetingId: string | null
  createdAt: string
  updatedAt: string
}

function attendeesLabel(req: MeetingRequestRow): string {
  if (req.attendees.length === 0) return 'someone'
  if (req.attendees.length === 1) return req.attendees[0].fullName
  return `${req.attendees[0].fullName} + ${req.attendees.length - 1} more`
}

function isAttendeeOf(req: MeetingRequestRow, memberId: string): boolean {
  return req.attendees.some((a) => a.id === memberId)
}

// Active = something the user might still take action on. Terminal
// states (rejected / declined / canceled / completed) drop out of the
// sheet so it stays an inbox. History stays visible on the dedicated
// /dashboard/meetings calendar page.
const ACTIVE_STATUSES: MeetingRequestRow['status'][] = [
  'pending',
  'approved',
  'scheduled'
]

function isActive(req: MeetingRequestRow): boolean {
  return ACTIVE_STATUSES.includes(req.status)
}

// True when the meeting's selectedStartsAt + durationMin has already
// passed (i.e. nothing left to join). Used to hide the Join button on
// past meetings.
function isMeetingOver(req: MeetingRequestRow): boolean {
  if (!req.selectedStartsAt) return false
  const ends =
    new Date(req.selectedStartsAt).getTime() + req.durationMin * 60_000
  return ends < Date.now()
}

// Cheap ticker so cards re-render at most once a minute - enough to
// flip the "Starts in 18m" chip down to 17m / 16m / Live now without
// the cost of a per-second interval.
function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return tick
}

type MeetingTimingChip = {
  label: string
  tone: 'live' | 'soon' | 'upcoming'
}

// Returns a short, human label for "when is this meeting?" relative to
// now. Null when the meeting hasn't been picked or has ended (the card
// already shows "This meeting has ended" for the ended case).
function meetingTimingChip(req: MeetingRequestRow): MeetingTimingChip | null {
  if (!req.selectedStartsAt) return null
  const start = new Date(req.selectedStartsAt).getTime()
  if (Number.isNaN(start)) return null
  const end = start + req.durationMin * 60_000
  const now = Date.now()
  if (now >= start && now <= end) return { label: 'Live now', tone: 'live' }
  if (now > end) return null
  const minutes = Math.round((start - now) / 60_000)
  if (minutes <= 60)
    return { label: `Starts in ${Math.max(minutes, 1)}m`, tone: 'soon' }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 12)
    return {
      label: mins > 0 ? `Starts in ${hours}h ${mins}m` : `Starts in ${hours}h`,
      tone: 'upcoming'
    }
  // Past 12h out, switch to day-relative phrasing so 47h doesn't read
  // worse than "tomorrow".
  const startDate = new Date(start)
  const nowDate = new Date(now)
  const dayDiff = Math.round(
    (new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    ).getTime() -
      new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate()
      ).getTime()) /
      86_400_000
  )
  if (dayDiff === 0) return { label: `Starts in ${hours}h`, tone: 'upcoming' }
  if (dayDiff === 1) return { label: 'Starts tomorrow', tone: 'upcoming' }
  return { label: `Starts in ${dayDiff} days`, tone: 'upcoming' }
}

const STATUS_LABEL: Record<MeetingRequestRow['status'], string> = {
  pending: 'Pending approval',
  approved: 'Approved - pick a time',
  rejected: 'Rejected',
  declined: 'Declined',
  scheduled: 'Scheduled',
  canceled: 'Canceled',
  completed: 'Completed'
}

// Same status, different reading depending on which side the viewer is
// on. 'approved' for the requester means "the other side has to pick,"
// for the attendee means "you have to pick."
function statusLabelFor(
  req: MeetingRequestRow,
  viewerId: string
): string {
  if (req.status === 'approved' && req.attendees.length === 1) {
    if (req.requesterId === viewerId) {
      const attendee = req.attendees[0]?.fullName ?? 'requestee'
      return `Approved - waiting on ${attendee.split(/\s+/)[0]}`
    }
    if (isAttendeeOf(req, viewerId)) {
      return 'Approved - pick a time'
    }
  }
  return STATUS_LABEL[req.status]
}

function fmtDate(dateIso: string, viewerTz: string | null): string {
  // dateIso is YYYY-MM-DD with no zone attached. Parse as local-noon
  // and format in the viewer's zone so the weekday doesn't shift across
  // the date-line for off-by-half-day cases.
  const d = new Date(`${dateIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateIso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: viewerTz ?? undefined
  }).format(d)
}

function fmtDateTime(iso: string, viewerTz: string | null): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: viewerTz ?? undefined,
    timeZoneName: 'short'
  }).format(d)
}

export function MeetingsSheetProvider({
  currentUserId,
  accessTier,
  children
}: {
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [openSheet, setOpenSheet] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<FocusKey | null>(null)

  const isPlanner = accessTier === 'admin' || accessTier === 'lead'
  const team = useTeam()
  const viewerTz =
    team.find((m) => m.id === currentUserId)?.timezone ?? null

  const pendingQuery = useQuery({
    queryKey: ['meetingRequests', 'pending'],
    queryFn: async () => {
      const res = await listPendingApprovals()
      if ('error' in res) return [] as MeetingRequestRow[]
      return res.requests as MeetingRequestRow[]
    },
    enabled: isPlanner,
    refetchInterval: 30_000
  })

  const mineQuery = useQuery({
    queryKey: ['meetingRequests', 'mine'],
    queryFn: async () => {
      const res = await listMyMeetingRequests()
      if ('error' in res) return [] as MeetingRequestRow[]
      return res.requests as MeetingRequestRow[]
    },
    refetchInterval: 30_000
  })

  const pending = pendingQuery.data ?? []
  const mine = mineQuery.data ?? []

  const awaitingPickCount = useMemo(
    () =>
      mine.filter(
        (r) =>
          r.status === 'approved' &&
          r.attendees.length === 1 &&
          isAttendeeOf(r, currentUserId)
      ).length,
    [mine, currentUserId]
  )

  const open = useCallback((args?: OpenArgs) => {
    if (args?.focusedRequestId) setFocusedId(args.focusedRequestId)
    setFocus(args?.focus ?? null)
    setOpenSheet(true)
  }, [])

  useEffect(() => {
    const id = searchParams.get('meetings')
    if (id && !openSheet) {
      setFocusedId(id)
      setOpenSheet(true)
    }
  }, [searchParams, openSheet])

  function handleClose(next: boolean) {
    setOpenSheet(next)
    if (!next) {
      setFocusedId(null)
      setFocus(null)
      const sp = new URLSearchParams(searchParams.toString())
      if (sp.has('meetings')) {
        sp.delete('meetings')
        router.replace(`?${sp.toString()}`, { scroll: false })
      }
    }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
    // A card action almost always empties the focused section
    // (approve removes from pending, pick removes from awaiting, etc).
    // Clearing focus afterwards lets the user see where the meeting
    // actually landed instead of staring at an empty filtered list.
    setFocus(null)
  }

  return (
    <MeetingsCtx.Provider
      value={{
        open,
        pendingApprovalCount: isPlanner ? pending.length : 0,
        awaitingPickCount
      }}
    >
      {children}
      <Sheet open={openSheet} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          className={`w-full p-0 sm:max-w-120! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>Meetings</SheetTitle>
          </VisuallyHidden.Root>

          <div className="flex h-full flex-col">
            <div
              className={`flex items-center gap-2.5 border-b px-4 py-3 ${t.border}`}
            >
              <Calendar className={`size-4 ${t.textMuted}`} />
              <span className={`text-xs font-medium ${t.text}`}>Meetings</span>
              {focus && (
                <>
                  <span className={`text-[10px] ${t.textSubtle}`}>/</span>
                  <span className={`text-xs ${t.textMuted}`}>
                    {focus === 'pending'
                      ? 'Pending approval'
                      : focus === 'awaiting'
                        ? 'Awaiting your pick'
                        : focus === 'review'
                          ? 'Awaiting your review'
                          : 'Scheduled'}
                  </span>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {focus && (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className={`mb-3 inline-flex items-center gap-1 text-[10px] ${t.textMuted} hover:underline`}
                >
                  ← Show all sections
                </button>
              )}
              <ListView
                isPlanner={isPlanner}
                pending={pending}
                mine={mine}
                currentUserId={currentUserId}
                viewerTz={viewerTz}
                awaitingPickCount={awaitingPickCount}
                focusedId={focusedId}
                focus={focus}
                onResolved={invalidate}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </MeetingsCtx.Provider>
  )
}

function ListView({
  isPlanner,
  pending,
  mine,
  currentUserId,
  viewerTz,
  awaitingPickCount,
  focusedId,
  focus,
  onResolved
}: {
  isPlanner: boolean
  pending: MeetingRequestRow[]
  mine: MeetingRequestRow[]
  currentUserId: string
  viewerTz: string | null
  awaitingPickCount: number
  focusedId: string | null
  focus: FocusKey | null
  onResolved: () => void
}) {
  const show = (key: 'pending' | 'awaiting' | 'review' | 'mine' | 'with-you') => {
    if (focus === null) return true
    if (focus === 'pending') return key === 'pending'
    if (focus === 'awaiting') return key === 'awaiting'
    if (focus === 'review') return key === 'review'
    // 'scheduled' surfaces in both "Your requests" and "Meetings with you".
    if (focus === 'scheduled') return key === 'mine' || key === 'with-you'
    return true
  }
  const rowMatchesFocus = (req: MeetingRequestRow) =>
    focus === 'scheduled' ? req.status === 'scheduled' : true

  const myRequests = mine.filter(
    (r) => r.requesterId === currentUserId && isActive(r) && rowMatchesFocus(r)
  )
  const withYou = mine.filter(
    (r) =>
      isAttendeeOf(r, currentUserId) &&
      isActive(r) &&
      r.status !== 'approved' &&
      rowMatchesFocus(r)
  )
  // "Awaiting your review" = meeting I participated in, status still
  // 'scheduled', and selected_starts_at + duration_min is already past.
  // The action also accepts 'completed' (re-edit) but the section only
  // surfaces unreviewed ones.
  const awaitingReview = mine.filter(
    (r) =>
      (r.requesterId === currentUserId ||
        isAttendeeOf(r, currentUserId)) &&
      r.status === 'scheduled' &&
      r.selectedStartsAt &&
      isMeetingOver(r) &&
      !r.reviewedAt
  )

  return (
    <>
      {show('pending') && (isPlanner || focus === 'pending') && (
        <Section title="Pending approval" count={pending.length}>
          {!isPlanner ? (
            <Empty>Only admins and leads see pending approvals.</Empty>
          ) : pending.length === 0 ? (
            <Empty>Nothing waiting.</Empty>
          ) : (
            pending.map((req) => (
              <PendingApprovalCard
                key={req.id}
                request={req}
                viewerTz={viewerTz}
                highlighted={req.id === focusedId}
                onResolved={onResolved}
              />
            ))
          )}
        </Section>
      )}

      {show('review') && awaitingReview.length > 0 && (
        <Section title="Awaiting your review" count={awaitingReview.length}>
          {awaitingReview.map((req) => (
            <ReviewCard
              key={req.id}
              request={req}
              viewerTz={viewerTz}
              onResolved={onResolved}
            />
          ))}
        </Section>
      )}

      {show('awaiting') && (
        <Section title="Awaiting your pick" count={awaitingPickCount}>
          {awaitingPickCount === 0 ? (
            <Empty>You have nothing to pick.</Empty>
          ) : (
            mine
              .filter(
                (r) =>
                  r.status === 'approved' &&
                  r.attendees.length === 1 &&
                  isAttendeeOf(r, currentUserId)
              )
              .map((req) => (
                <PickCard
                  key={req.id}
                  request={req}
                  viewerTz={viewerTz}
                  highlighted={req.id === focusedId}
                  onResolved={onResolved}
                />
              ))
          )}
        </Section>
      )}

      {show('mine') && (
        <Section
          title={focus === 'scheduled' ? 'Your scheduled' : 'Your requests'}
          count={myRequests.length}
        >
          {myRequests.length === 0 ? (
            <Empty>
              {focus === 'scheduled'
                ? 'No scheduled meetings of yours yet.'
                : 'You have no active requests. Past meetings live on the Calendar page.'}
            </Empty>
          ) : (
            myRequests.map((req) => (
              <RequestStatusCard
                key={req.id}
                request={req}
                currentUserId={currentUserId}
                viewerTz={viewerTz}
                onResolved={onResolved}
              />
            ))
          )}
        </Section>
      )}

      {show('with-you') && (
        <Section
          title={
            focus === 'scheduled' ? 'Scheduled with you' : 'Meetings with you'
          }
          count={withYou.length}
        >
          {withYou.length === 0 ? (
            <Empty>
              {focus === 'scheduled'
                ? 'Nothing scheduled with you yet.'
                : 'Nobody has scheduled a meeting with you yet.'}
            </Empty>
          ) : (
            withYou.map((req) => (
              <RequestStatusCard
                key={req.id}
                request={req}
                currentUserId={currentUserId}
                viewerTz={viewerTz}
                onResolved={onResolved}
              />
            ))
          )}
        </Section>
      )}
    </>
  )
}

function Section({
  title,
  count,
  children
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
          {title}
        </span>
        <span className={`text-[10px] ${t.textSubtle}`}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  const { t } = useDashTheme()
  return <p className={`text-[11px] italic ${t.textSubtle}`}>{children}</p>
}

function CardShell({
  highlighted,
  children
}: {
  highlighted?: boolean
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`rounded-md border p-3 ${t.border} ${
        highlighted ? 'ring-2 ring-teal-500' : ''
      }`}
    >
      {children}
    </div>
  )
}

// Native <details> disclosure. Closed state: a one-line summary of the
// goal with a subtle chevron at the end. Open state: a soft-bg panel
// with a 2-column "key | value" grid (labels left, content right) so
// the eye can scan straight down. Pre-read renders as a chip row, not
// bullets. Hidden when every brief field is empty.
function BriefPreview({
  request,
  includeAgenda = false
}: {
  request: MeetingRequestRow
  includeAgenda?: boolean
}) {
  const { t } = useDashTheme()
  const goal = request.goal?.trim() || null
  const context = request.context?.trim() || null
  const questions = request.questions?.trim() || null
  const agenda = includeAgenda ? request.agenda?.trim() || null : null
  const preReadLinks = (request.preRead ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const hasMore =
    Boolean(context) ||
    Boolean(questions) ||
    Boolean(agenda) ||
    preReadLinks.length > 0
  if (!goal && !hasMore) return null

  const summary = (
    <span
      className={`min-w-0 flex-1 truncate text-[11px] leading-snug ${t.text}`}
      title={goal ?? undefined}
    >
      {goal ?? <span className={t.textMuted}>No goal set</span>}
    </span>
  )

  if (!hasMore) {
    return <div className="mb-2 flex items-center gap-1.5">{summary}</div>
  }

  return (
    <details className="group mb-2">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-md py-0.5 outline-none [&::-webkit-details-marker]:hidden`}
      >
        {summary}
        <span
          className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] transition group-open:rotate-180 ${t.textMuted}`}
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div
        className={`mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md border p-2.5 text-[11px] leading-snug ${t.border} ${t.surfaceMuted}`}
      >
        {context && <BriefRow label="Context" body={context} />}
        {questions && <BriefRow label="Questions" body={questions} />}
        {agenda && <BriefRow label="Internal" body={agenda} />}
        {preReadLinks.length > 0 && (
          <>
            <span
              className={`pt-0.5 text-[9px] tracking-wider uppercase ${t.textMuted}`}
            >
              Pre-read
            </span>
            <ul className="flex min-w-0 flex-col gap-0.5">
              {preReadLinks.map((url, i) => (
                <li key={`${url}-${i}`} className="min-w-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`block truncate text-[11px] hover:underline ${t.text}`}
                    title={url}
                  >
                    {url.replace(/^https?:\/\//, '')}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}

function BriefRow({ label, body }: { label: string; body: string }) {
  const { t } = useDashTheme()
  return (
    <>
      <span
        className={`pt-0.5 text-[9px] tracking-wider uppercase ${t.textMuted}`}
      >
        {label}
      </span>
      <span className={`min-w-0 whitespace-pre-wrap ${t.text}`}>{body}</span>
    </>
  )
}

function ProposedSummary({
  request,
  viewerTz
}: {
  request: MeetingRequestRow
  viewerTz: string | null
}) {
  const { t } = useDashTheme()
  if (request.mode === 'day' && request.proposedDate) {
    return (
      <p className={`mb-2 text-[11px] ${t.text}`}>
        Day: <strong>{fmtDate(request.proposedDate, viewerTz)}</strong>
      </p>
    )
  }
  if (request.mode === 'slots' && request.slots && request.slots.length > 0) {
    return (
      <div className="mb-2">
        <p className={`mb-1 text-[10px] ${t.textMuted}`}>Proposed slots:</p>
        <ul className="list-inside list-disc">
          {request.slots.map((s, i) => (
            <li key={i} className={`text-[11px] ${t.text}`}>
              {fmtDateTime(s, viewerTz)}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}

function PendingApprovalCard({
  request,
  viewerTz,
  highlighted,
  onResolved
}: {
  request: MeetingRequestRow
  viewerTz: string | null
  highlighted: boolean
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [busy, startBusy] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  function approve() {
    // Optimistic: drop from pending queue; flip status in mine if the
    // approver also participates. 1:1 → 'approved' (awaiting pick),
    // group → 'scheduled' (admin approve locks the time).
    const nextStatus: MeetingRequestRow['status'] =
      request.attendees.length >= 2 ? 'scheduled' : 'approved'
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'pending'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'mine'],
      (old) => {
        const list = old ?? []
        const exists = list.some((r) => r.id === request.id)
        if (exists) {
          return list.map((r) =>
            r.id === request.id ? { ...r, status: nextStatus } : r
          )
        }
        return list
      }
    )
    startBusy(async () => {
      const res = await approveMeetingRequest(request.id)
      if ('error' in res) {
        toast.error(res.error)
        // Server rejected the action - re-sync from source of truth.
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success('Approved.')
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  function reject() {
    if (!rejecting) {
      setRejecting(true)
      return
    }
    // Optimistic: rejected meetings drop out of every active list, so
    // just remove from pending and from mine.
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'pending'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'mine'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    startBusy(async () => {
      const res = await rejectMeetingRequest(request.id, reason)
      if ('error' in res) {
        toast.error(res.error)
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success('Rejected.')
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  return (
    <CardShell highlighted={highlighted}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
          <p className={`text-[10px] ${t.textMuted}`}>
            {request.requesterName} → {attendeesLabel(request)} ·{' '}
            {request.durationMin} min
          </p>
        </div>
      </div>
      <BriefPreview request={request} includeAgenda />
      <ProposedSummary request={request} viewerTz={viewerTz} />
      {rejecting && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional reason..."
          className={`mb-2 w-full resize-none rounded-md border px-2 py-1.5 text-[11px] ${t.input}`}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <ShareButtons request={request} />
          <ResendButton request={request} />
        </div>
        <div className="flex items-center gap-1.5">
          {rejecting && (
            <button
              onClick={() => setRejecting(false)}
              disabled={busy}
              className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
            >
              Back
            </button>
          )}
          <button
            onClick={reject}
            disabled={busy}
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.border} ${t.btn}`}
          >
            <XIcon className="size-3" />
            {rejecting ? 'Confirm reject' : 'Reject'}
          </button>
          {!rejecting && (
            <button
              onClick={approve}
              disabled={busy}
              className={`inline-flex h-7 items-center gap-1 rounded-md bg-teal-600 px-2 text-[11px] text-white disabled:opacity-40 hover:bg-teal-700`}
            >
              <Check className="size-3" /> Approve
            </button>
          )}
        </div>
      </div>
    </CardShell>
  )
}

function combineDateTime(dateIso: string, hhmm: string): string {
  return new Date(`${dateIso}T${hhmm}`).toISOString()
}

function PickCard({
  request,
  viewerTz,
  highlighted,
  onResolved
}: {
  request: MeetingRequestRow
  viewerTz: string | null
  highlighted: boolean
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const requesterTz =
    team.find((m) => m.id === request.requesterId)?.timezone ?? null
  function requesterPreview(iso: string): string | null {
    if (!requesterTz || requesterTz === viewerTz) return null
    return formatTimeIn(iso, requesterTz, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }
  const queryClient = useQueryClient()
  const [busy, startBusy] = useTransition()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [timeStr, setTimeStr] = useState<string>('10:00')

  // Picking flips the meeting from 'approved' (awaiting pick) into
  // 'scheduled' with selected_starts_at populated. Same shape for both
  // mode='day' (pickMeetingTime) and mode='slots' (pickMeetingSlot).
  function applyPickOptimistic(startsAtIso: string, slotIndex: number | null) {
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'mine'],
      (old) =>
        (old ?? []).map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: 'scheduled',
                selectedStartsAt: startsAtIso,
                selectedSlotIndex: slotIndex
              }
            : r
        )
    )
  }

  function pickDayTime() {
    if (!timeStr || !request.proposedDate) return
    const startsAt = combineDateTime(request.proposedDate, timeStr)
    applyPickOptimistic(startsAt, null)
    startBusy(async () => {
      const res = await pickMeetingTime(request.id, startsAt)
      if ('error' in res) {
        toast.error(res.error)
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success(
        'Time booked. Calendar invite goes out once the scheduler is connected.'
      )
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  function pickSlot(slotIndex: number) {
    const slot = request.slots?.[slotIndex]
    if (slot) applyPickOptimistic(slot, slotIndex)
    startBusy(async () => {
      const res = await pickMeetingSlot(request.id, slotIndex)
      if ('error' in res) {
        toast.error(res.error)
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success(
        'Slot booked. Calendar invite goes out once the scheduler is connected.'
      )
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  function decline() {
    if (!declining) {
      setDeclining(true)
      return
    }
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'mine'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    startBusy(async () => {
      const res = await declineMeetingRequest(request.id, reason)
      if ('error' in res) {
        toast.error(res.error)
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success('Declined.')
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  return (
    <CardShell highlighted={highlighted}>
      <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
      <p className={`mb-2 text-[10px] ${t.textMuted}`}>
        From {request.requesterName} · {request.durationMin} min
      </p>
      <BriefPreview request={request} />

      {request.mode === 'day' && request.proposedDate ? (
        (() => {
          // End-of-day: the proposed_date is just YYYY-MM-DD; treat the
          // day as "past" once the local 23:59:59 has passed.
          const dayPast =
            new Date(`${request.proposedDate}T23:59:59`).getTime() < Date.now()
          if (dayPast) {
            return (
              <div
                className={`mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700`}
              >
                Proposed day ({fmtDate(request.proposedDate, viewerTz)}) has
                passed. Ask {request.requesterName.split(/\s+/)[0]} to
                reschedule.
              </div>
            )
          }
          return (
            <>
              <p className={`mb-2 text-[11px] ${t.text}`}>
                Day: <strong>{fmtDate(request.proposedDate, viewerTz)}</strong>
              </p>
              <div className="mb-2 flex items-center gap-2">
                <span className={`text-[10px] ${t.textMuted}`}>Time</span>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  step={900}
                  className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
                />
                <button
                  onClick={pickDayTime}
                  disabled={busy || !timeStr}
                  className={`inline-flex h-8 items-center gap-1 rounded-md bg-teal-600 px-2.5 text-[11px] text-white disabled:opacity-40 hover:bg-teal-700`}
                >
                  <Check className="size-3" /> Pick
                </button>
              </div>
            </>
          )
        })()
      ) : (
        (() => {
          const slotsList = request.slots ?? []
          const now = Date.now()
          const slotPast = (iso: string) =>
            new Date(iso).getTime() < now
          const allPast =
            slotsList.length > 0 && slotsList.every(slotPast)
          if (allPast) {
            return (
              <div
                className={`mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700`}
              >
                All proposed slots have passed. Ask{' '}
                {request.requesterName.split(/\s+/)[0]} to reschedule.
              </div>
            )
          }
          return (
            <div className="mb-2 flex flex-col gap-1">
              {slotsList.map((s, i) => {
                const past = slotPast(s)
                return (
                  <button
                    key={i}
                    onClick={() => pickSlot(i)}
                    disabled={busy || past}
                    className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-teal-500/10 ${t.border} ${t.text}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={past ? 'line-through' : ''}>
                        {fmtDateTime(s, viewerTz)}
                      </span>
                      {!past && requesterPreview(s) && (
                        <span className={`text-[9px] ${t.textSubtle}`}>
                          requester: {requesterPreview(s)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] ${past ? 'text-amber-600' : t.textMuted}`}
                    >
                      {past ? 'slot passed' : 'Pick'}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()
      )}

      {declining && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional reason..."
          className={`mb-2 w-full resize-none rounded-md border px-2 py-1.5 text-[11px] ${t.input}`}
        />
      )}
      <div className="flex items-center justify-end gap-1.5">
        {declining && (
          <button
            onClick={() => setDeclining(false)}
            disabled={busy}
            className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
          >
            Back
          </button>
        )}
        <button
          onClick={decline}
          disabled={busy}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.border} ${t.btn}`}
        >
          {declining ? 'Confirm decline' : 'Decline'}
        </button>
      </div>
    </CardShell>
  )
}

function RequestStatusCard({
  request,
  currentUserId,
  viewerTz,
  onResolved
}: {
  request: MeetingRequestRow
  currentUserId: string
  viewerTz: string | null
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [busy, startBusy] = useTransition()
  const [rescheduling, setRescheduling] = useState(false)
  // Tick so the timing chip re-renders ("Starts in 18m" → "Live now")
  // without waiting for a refetch.
  useMinuteTick()
  const isRequester = request.requesterId === currentUserId
  const isParticipant = isRequester || isAttendeeOf(request, currentUserId)
  const canCancel =
    isRequester &&
    (request.status === 'pending' ||
      request.status === 'approved' ||
      request.status === 'scheduled')
  const canReschedule =
    isParticipant &&
    (request.status === 'pending' ||
      request.status === 'approved' ||
      request.status === 'scheduled')

  function cancel() {
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'mine'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    queryClient.setQueryData<MeetingRequestRow[]>(
      ['meetingRequests', 'pending'],
      (old) => (old ?? []).filter((r) => r.id !== request.id)
    )
    startBusy(async () => {
      const res = await cancelMeetingRequest(request.id)
      if ('error' in res) {
        toast.error(res.error)
        queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
        return
      }
      toast.success('Canceled.')
      notifyEmailStatus(res.emailStatus)
      onResolved()
    })
  }

  const counterpartyName = isRequester
    ? attendeesLabel(request)
    : request.requesterName

  // What date/time to surface in the card body. Scheduled → the picked
  // instant. Otherwise → the proposed day (day mode) or the slot list
  // is rendered via ProposedSummary.
  const showScheduled =
    request.status === 'scheduled' && request.selectedStartsAt

  // Detect stale proposals: meeting is still awaiting a pick but every
  // proposed slot / proposed day is already in the past. Requester
  // can't expect the requestee to time-travel; surface a reschedule
  // nudge instead of pretending the meeting is healthy.
  const slotsList = request.slots ?? []
  const allSlotsPast =
    request.status === 'pending' || request.status === 'approved'
      ? request.mode === 'slots'
        ? slotsList.length > 0 &&
          slotsList.every((s) => new Date(s).getTime() < Date.now())
        : request.mode === 'day' && request.proposedDate
          ? new Date(`${request.proposedDate}T23:59:59`).getTime() < Date.now()
          : false
      : false

  return (
    <CardShell>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
        {allSlotsPast ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            All slots passed - reschedule?
          </span>
        ) : (
          <span className={`text-[10px] ${t.textMuted}`}>
            {statusLabelFor(request, currentUserId)}
          </span>
        )}
      </div>
      <p className={`mb-1 text-[10px] ${t.textMuted}`}>
        {isRequester ? 'With' : 'From'} {counterpartyName} ·{' '}
        {request.durationMin} min
      </p>
      {showScheduled ? (
        <p className={`mb-2 text-[11px] ${t.text}`}>
          {fmtDateTime(request.selectedStartsAt!, viewerTz)}
        </p>
      ) : (
        <ProposedSummary request={request} viewerTz={viewerTz} />
      )}
      <BriefPreview request={request} includeAgenda />
      {request.meetLink && !isMeetingOver(request) && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {(() => {
            const chip = meetingTimingChip(request)
            if (!chip) return null
            const tone =
              chip.tone === 'live'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700'
                : chip.tone === 'soon'
                  ? 'border-teal-500/40 bg-teal-500/15 text-teal-700'
                  : `${t.border} ${t.textMuted}`
            return (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
              >
                {chip.tone === 'live' && (
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                )}
                {chip.label}
              </span>
            )
          })()}
          <a
            href={request.meetLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-6 items-center gap-1 rounded-full bg-teal-600 px-2.5 text-[10px] font-medium text-white transition hover:bg-teal-700"
          >
            Join Google Meet
          </a>
        </div>
      )}
      {isMeetingOver(request) && request.status === 'scheduled' && (
        <p className={`text-[10px] italic ${t.textSubtle}`}>
          This meeting has ended.
        </p>
      )}
      {request.rejectionReason && (
        <p className={`text-[10px] italic ${t.textSubtle}`}>
          Reason: {request.rejectionReason}
        </p>
      )}
      {request.declineReason && (
        <p className={`text-[10px] italic ${t.textSubtle}`}>
          Reason: {request.declineReason}
        </p>
      )}
      {!isRequester &&
        isParticipant &&
        (request.status === 'approved' || request.status === 'scheduled') && (
          <RequesteeContextEditor
            meetingId={request.id}
            initial={request.requesteeContext}
            onSaved={onResolved}
          />
        )}
      {isRequester && request.requesteeContext && (
        <div
          className={`mt-2 rounded border px-2 py-1.5 text-[11px] whitespace-pre-wrap ${t.border} ${t.surfaceMuted}`}
        >
          <span
            className={`mb-0.5 block text-[9px] tracking-wider uppercase ${t.textMuted}`}
          >
            From {request.attendees[0]?.fullName ?? 'attendee'}
          </span>
          <span className={t.text}>{request.requesteeContext}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <ShareButtons request={request} />
          <ResendButton request={request} />
        </div>
        <div className="flex items-center gap-1.5">
          {canReschedule && !rescheduling && (
            <button
              onClick={() => setRescheduling(true)}
              disabled={busy}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] disabled:opacity-40 ${
                allSlotsPast
                  ? 'border-amber-500/40 bg-amber-500/15 font-medium text-amber-700 hover:bg-amber-500/25'
                  : t.btn
              }`}
            >
              Reschedule
            </button>
          )}
          {canCancel && (
            <button
              onClick={cancel}
              disabled={busy}
              className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.btn}`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      {rescheduling && (
        <RescheduleForm
          request={request}
          onResolved={() => {
            setRescheduling(false)
            onResolved()
          }}
        />
      )}
    </CardShell>
  )
}

const OUTCOMES: { id: MeetingOutcome; label: string; tone: string }[] = [
  {
    id: 'resolved',
    label: 'Resolved',
    tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
  },
  {
    id: 'partial',
    label: 'Partial',
    tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30'
  },
  {
    id: 'needs_followup',
    label: 'Needs follow-up',
    tone: 'bg-sky-500/10 text-sky-700 border-sky-500/30'
  },
  {
    id: 'failed',
    label: "Didn't deliver",
    tone: 'bg-rose-500/10 text-rose-700 border-rose-500/30'
  }
]

function ReviewCard({
  request,
  viewerTz,
  onResolved
}: {
  request: MeetingRequestRow
  viewerTz: string | null
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, startBusy] = useTransition()

  function submit() {
    if (!outcome) {
      toast.error('Pick an outcome first.')
      return
    }
    startBusy(async () => {
      const res = await submitMeetingReview(request.id, {
        outcome,
        notes: notes.trim() || null
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Review saved. Meeting marked complete.')
      onResolved()
    })
  }

  return (
    <CardShell>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
        <span className={`text-[10px] ${t.textMuted}`}>
          {request.selectedStartsAt &&
            fmtDateTime(request.selectedStartsAt, viewerTz)}
        </span>
      </div>
      <p className={`mb-2 text-[10px] ${t.textMuted}`}>
        How did it go? Pick one and (optionally) leave a few notes.
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOutcome(o.id)}
            className={`inline-flex h-6 items-center rounded-full border px-2 text-[10px] transition ${
              outcome === o.id ? o.tone : `${t.border} ${t.textMuted}`
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={4000}
        placeholder="What was decided? Any open threads?"
        className={`mb-2 w-full resize-none rounded-md border px-2 py-1.5 text-[11px] leading-relaxed ${t.input}`}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={submit}
          disabled={busy || !outcome}
          className={`inline-flex h-7 items-center rounded-md px-2.5 text-[11px] disabled:opacity-40 ${t.accent}`}
        >
          {busy ? 'Saving...' : 'Save review'}
        </button>
      </div>
    </CardShell>
  )
}

function RequesteeContextEditor({
  meetingId,
  initial,
  onSaved
}: {
  meetingId: string
  initial: string | null
  onSaved: () => void
}) {
  const { t } = useDashTheme()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial ?? '')
  const [busy, startBusy] = useTransition()

  function save() {
    const trimmed = draft.trim()
    if (!trimmed) {
      toast.error('Add a few words before saving.')
      return
    }
    startBusy(async () => {
      const res = await appendMeetingContext(meetingId, trimmed)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Saved.')
      setEditing(false)
      onSaved()
    })
  }

  if (!editing && !initial) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`mt-2 inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-[10px] ${t.border} ${t.textMuted}`}
      >
        <Plus className="size-2.5" /> Add what you&apos;re bringing
      </button>
    )
  }

  if (!editing && initial) {
    return (
      <div
        className={`mt-2 rounded border px-2 py-1.5 text-[11px] whitespace-pre-wrap ${t.border} ${t.surfaceMuted}`}
      >
        <div className="mb-0.5 flex items-baseline justify-between">
          <span
            className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
          >
            What you&apos;re bringing
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`text-[10px] ${t.textMuted} hover:underline`}
          >
            Edit
          </button>
        </div>
        <span className={t.text}>{initial}</span>
      </div>
    )
  }

  return (
    <div className={`mt-2 flex flex-col gap-1.5 rounded border p-2 ${t.border}`}>
      <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
        What you&apos;re bringing (optional)
      </span>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={4000}
        autoFocus
        placeholder="What you already know, what you'll bring to the call, what you'd like to leave with..."
        className={`resize-none rounded-md border px-2 py-1.5 text-[11px] leading-relaxed ${t.input}`}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setDraft(initial ?? '')
            setEditing(false)
          }}
          disabled={busy}
          className={`h-6 rounded-md border px-2 text-[10px] ${t.btn}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !draft.trim()}
          className={`inline-flex h-6 items-center rounded-md px-2.5 text-[10px] disabled:opacity-40 ${t.accent}`}
        >
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function RescheduleForm({
  request,
  onResolved
}: {
  request: MeetingRequestRow
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const isGroup = request.attendees.length >= 2
  // For groups: one locked time (mode='slots', slots=[iso]).
  // For 1:1: respect existing mode (day → new date, slots → new 2-3).
  const [reason, setReason] = useState('')
  const [groupTime, setGroupTime] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setMinutes(0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
  })
  const [newDate, setNewDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })
  const [newSlots, setNewSlots] = useState<string[]>(() => {
    const make = (offset: number) => {
      const d = new Date()
      d.setHours(d.getHours() + offset)
      d.setMinutes(0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
    }
    return [make(24), make(48)]
  })
  const [busy, startBusy] = useTransition()

  function submit() {
    startBusy(async () => {
      let res
      if (isGroup) {
        res = await rescheduleMeetingRequest(request.id, {
          mode: 'slots',
          slots: [new Date(groupTime).toISOString()],
          reason: reason.trim() || null
        })
      } else if (request.mode === 'day') {
        res = await rescheduleMeetingRequest(request.id, {
          mode: 'day',
          proposedDate: newDate,
          reason: reason.trim() || null
        })
      } else {
        res = await rescheduleMeetingRequest(request.id, {
          mode: 'slots',
          slots: newSlots.map((s) => new Date(s).toISOString()),
          reason: reason.trim() || null
        })
      }
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Rescheduled.')
      onResolved()
    })
  }

  return (
    <div
      className={`mt-2 flex flex-col gap-2 rounded-md border p-2 ${t.border} ${t.surfaceMuted}`}
    >
      {isGroup ? (
        <label className="flex flex-col gap-1">
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
            New locked time
          </span>
          <input
            type="datetime-local"
            value={groupTime}
            onChange={(e) => setGroupTime(e.target.value)}
            className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
          />
        </label>
      ) : request.mode === 'day' ? (
        <label className="flex flex-col gap-1">
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
            New day
          </span>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-1">
          <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
            New slots ({newSlots.length}/3)
          </span>
          {newSlots.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="datetime-local"
                value={s}
                onChange={(e) =>
                  setNewSlots(
                    newSlots.map((x, idx) => (idx === i ? e.target.value : x))
                  )
                }
                className={`h-8 flex-1 rounded-md border px-2 text-[11px] ${t.input}`}
              />
              {newSlots.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setNewSlots(newSlots.filter((_, idx) => idx !== i))
                  }
                  className={`text-[10px] ${t.textMuted} hover:underline`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {newSlots.length < 3 && (
            <button
              type="button"
              onClick={() => {
                const d = new Date()
                d.setHours(d.getHours() + 24 * (newSlots.length + 1))
                d.setMinutes(0, 0, 0)
                const pad = (n: number) => String(n).padStart(2, '0')
                const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
                setNewSlots([...newSlots, iso])
              }}
              className={`text-[10px] ${t.textMuted} hover:underline self-start`}
            >
              + Add slot
            </button>
          )}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
          Reason (optional)
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Why are you moving it?"
          className={`h-8 rounded-md border px-2 text-[11px] ${t.input}`}
        />
      </label>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => onResolved()}
          disabled={busy}
          className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className={`h-7 rounded-md bg-teal-600 px-2.5 text-[11px] text-white disabled:opacity-40 hover:bg-teal-700`}
        >
          {busy ? 'Saving...' : 'Reschedule'}
        </button>
      </div>
    </div>
  )
}

// Manual email re-fire. Surfaces a small "Resend email" button on the
// card so the user can recover when Resend silently dropped a
// notification. Only shown for statuses that have a meaningful email
// to send (pending / approved / scheduled).
function ResendButton({ request }: { request: MeetingRequestRow }) {
  const { t } = useDashTheme()
  const [busy, startBusy] = useTransition()
  const visible =
    request.status === 'pending' ||
    request.status === 'approved' ||
    request.status === 'scheduled'
  if (!visible) return null
  const label =
    request.status === 'pending'
      ? 'Re-send to approvers'
      : request.status === 'approved'
        ? 'Re-send pick-a-time email'
        : 'Re-send scheduled email'
  function resend() {
    startBusy(async () => {
      const res = await resendMeetingNotification(request.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (res.emailStatus.failures.length > 0) {
        notifyEmailStatus(res.emailStatus)
        return
      }
      if (res.emailStatus.sent === 0) {
        toast.info('No recipients (everyone has opted out or has no email).')
        return
      }
      toast.success(
        `Email re-sent (${res.emailStatus.sent} recipient${res.emailStatus.sent === 1 ? '' : 's'}).`
      )
    })
  }
  return (
    <button
      type="button"
      onClick={resend}
      disabled={busy}
      title={label}
      className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] disabled:opacity-50 ${t.border} ${t.btn}`}
    >
      <Mail className="size-3" /> {busy ? 'Sending...' : 'Resend email'}
    </button>
  )
}

function ShareButtons({ request }: { request: MeetingRequestRow }) {
  const { t } = useDashTheme()
  // Only meetings with a public-visible status get share buttons. This
  // mirrors fetchMeetingForShare on the server (pending / approved /
  // scheduled / completed return a page; rejected / declined / canceled
  // 404). For 'pending' it's still a placeholder; OK to share since the
  // share page renders the status pill so the receiver knows.
  const shareable =
    request.status === 'pending' ||
    request.status === 'approved' ||
    request.status === 'scheduled' ||
    request.status === 'completed'
  if (!shareable) return null
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/meeting/${request.id}`
      : `/share/meeting/${request.id}`
  function copy() {
    if (typeof window === 'undefined') return
    void navigator.clipboard.writeText(shareUrl)
    toast.success('Share link copied.')
  }
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${request.title}\n${shareUrl}`)}`
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={copy}
        title="Copy share link"
        className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] ${t.border} ${t.btn}`}
      >
        <Copy className="size-3" /> Share link
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        title="Share on WhatsApp"
        className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] ${t.border} ${t.btn}`}
      >
        <MessageCircle className="size-3" /> WhatsApp
      </a>
    </div>
  )
}
