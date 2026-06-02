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
import { Calendar, Check, X as XIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import { useDashTheme } from './theme'
import {
  approveMeetingRequest,
  cancelMeetingRequest,
  declineMeetingRequest,
  listMyMeetingRequests,
  listPendingApprovals,
  pickMeetingSlot,
  pickMeetingTime,
  rejectMeetingRequest
} from '../actions'

// Single sheet that surfaces meeting-request state, scoped to the
// current viewer's role:
//   - admin / lead: pending approvals + their own requests
//   - member: their own requests + meetings where they're the requestee

interface OpenArgs {
  focusedRequestId?: string
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
  requesteeId: string
  requesteeName: string
  approvedById: string | null
  approvedAt: string | null
  rejectionReason: string | null
  declineReason: string | null
  createdAt: string
  updatedAt: string
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

function fmtDate(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateIso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
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

  const isPlanner = accessTier === 'admin' || accessTier === 'lead'

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
        (r) => r.status === 'approved' && r.requesteeId === currentUserId
      ).length,
    [mine, currentUserId]
  )

  const open = useCallback((args?: OpenArgs) => {
    if (args?.focusedRequestId) setFocusedId(args.focusedRequestId)
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
      const sp = new URLSearchParams(searchParams.toString())
      if (sp.has('meetings')) {
        sp.delete('meetings')
        router.replace(`?${sp.toString()}`, { scroll: false })
      }
    }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
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
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isPlanner && (
                <Section title="Pending approval" count={pending.length}>
                  {pending.length === 0 ? (
                    <Empty>Nothing waiting.</Empty>
                  ) : (
                    pending.map((req) => (
                      <PendingApprovalCard
                        key={req.id}
                        request={req}
                        highlighted={req.id === focusedId}
                        onResolved={invalidate}
                      />
                    ))
                  )}
                </Section>
              )}

              <Section title="Awaiting your pick" count={awaitingPickCount}>
                {awaitingPickCount === 0 ? (
                  <Empty>You have nothing to pick.</Empty>
                ) : (
                  mine
                    .filter(
                      (r) =>
                        r.status === 'approved' &&
                        r.requesteeId === currentUserId
                    )
                    .map((req) => (
                      <PickCard
                        key={req.id}
                        request={req}
                        highlighted={req.id === focusedId}
                        onResolved={invalidate}
                      />
                    ))
                )}
              </Section>

              <Section
                title="Your requests"
                count={mine.filter((r) => r.requesterId === currentUserId).length}
              >
                {mine.filter((r) => r.requesterId === currentUserId).length ===
                0 ? (
                  <Empty>You haven&apos;t requested any meetings yet.</Empty>
                ) : (
                  mine
                    .filter((r) => r.requesterId === currentUserId)
                    .map((req) => (
                      <RequestStatusCard
                        key={req.id}
                        request={req}
                        currentUserId={currentUserId}
                        onResolved={invalidate}
                      />
                    ))
                )}
              </Section>

              <Section
                title="Meetings with you"
                count={
                  mine.filter(
                    (r) =>
                      r.requesteeId === currentUserId && r.status !== 'approved'
                  ).length
                }
              >
                {mine.filter(
                  (r) =>
                    r.requesteeId === currentUserId && r.status !== 'approved'
                ).length === 0 ? (
                  <Empty>Nobody has scheduled a meeting with you yet.</Empty>
                ) : (
                  mine
                    .filter(
                      (r) =>
                        r.requesteeId === currentUserId &&
                        r.status !== 'approved'
                    )
                    .map((req) => (
                      <RequestStatusCard
                        key={req.id}
                        request={req}
                        currentUserId={currentUserId}
                        onResolved={invalidate}
                      />
                    ))
                )}
              </Section>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </MeetingsCtx.Provider>
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

function ProposedSummary({
  request
}: {
  request: MeetingRequestRow
}) {
  const { t } = useDashTheme()
  if (request.mode === 'day' && request.proposedDate) {
    return (
      <p className={`mb-2 text-[11px] ${t.text}`}>
        Day: <strong>{fmtDate(request.proposedDate)}</strong>
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
              {fmtDateTime(s)}
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
  highlighted,
  onResolved
}: {
  request: MeetingRequestRow
  highlighted: boolean
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const [busy, startBusy] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  function approve() {
    startBusy(async () => {
      const res = await approveMeetingRequest(request.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Approved.')
      onResolved()
    })
  }

  function reject() {
    if (!rejecting) {
      setRejecting(true)
      return
    }
    startBusy(async () => {
      const res = await rejectMeetingRequest(request.id, reason)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Rejected.')
      onResolved()
    })
  }

  return (
    <CardShell highlighted={highlighted}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
          <p className={`text-[10px] ${t.textMuted}`}>
            {request.requesterName} → {request.requesteeName} ·{' '}
            {request.durationMin} min
          </p>
        </div>
      </div>
      {request.agenda && (
        <p className={`mb-2 text-[11px] ${t.textMuted}`}>{request.agenda}</p>
      )}
      <ProposedSummary request={request} />
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
      <div className="flex items-center justify-end gap-1.5">
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
    </CardShell>
  )
}

function combineDateTime(dateIso: string, hhmm: string): string {
  return new Date(`${dateIso}T${hhmm}`).toISOString()
}

function PickCard({
  request,
  highlighted,
  onResolved
}: {
  request: MeetingRequestRow
  highlighted: boolean
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const [busy, startBusy] = useTransition()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [timeStr, setTimeStr] = useState<string>('10:00')

  function pickDayTime() {
    if (!timeStr || !request.proposedDate) return
    const startsAt = combineDateTime(request.proposedDate, timeStr)
    startBusy(async () => {
      const res = await pickMeetingTime(request.id, startsAt)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        'Time booked. Calendar invite goes out once the scheduler is connected.'
      )
      onResolved()
    })
  }

  function pickSlot(slotIndex: number) {
    startBusy(async () => {
      const res = await pickMeetingSlot(request.id, slotIndex)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        'Slot booked. Calendar invite goes out once the scheduler is connected.'
      )
      onResolved()
    })
  }

  function decline() {
    if (!declining) {
      setDeclining(true)
      return
    }
    startBusy(async () => {
      const res = await declineMeetingRequest(request.id, reason)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Declined.')
      onResolved()
    })
  }

  return (
    <CardShell highlighted={highlighted}>
      <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
      <p className={`mb-2 text-[10px] ${t.textMuted}`}>
        From {request.requesterName} · {request.durationMin} min
      </p>
      {request.agenda && (
        <p className={`mb-2 text-[11px] ${t.textMuted}`}>{request.agenda}</p>
      )}

      {request.mode === 'day' && request.proposedDate ? (
        <>
          <p className={`mb-2 text-[11px] ${t.text}`}>
            Day: <strong>{fmtDate(request.proposedDate)}</strong>
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
      ) : (
        <div className="mb-2 flex flex-col gap-1">
          {(request.slots ?? []).map((s, i) => (
            <button
              key={i}
              onClick={() => pickSlot(i)}
              disabled={busy}
              className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition disabled:opacity-40 hover:bg-teal-500/10 ${t.border} ${t.text}`}
            >
              <span>{fmtDateTime(s)}</span>
              <span className={`text-[9px] ${t.textMuted}`}>Pick</span>
            </button>
          ))}
        </div>
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
  onResolved
}: {
  request: MeetingRequestRow
  currentUserId: string
  onResolved: () => void
}) {
  const { t } = useDashTheme()
  const [busy, startBusy] = useTransition()
  const isRequester = request.requesterId === currentUserId
  const canCancel =
    isRequester &&
    (request.status === 'pending' ||
      request.status === 'approved' ||
      request.status === 'scheduled')

  function cancel() {
    startBusy(async () => {
      const res = await cancelMeetingRequest(request.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Canceled.')
      onResolved()
    })
  }

  const counterpartyName = isRequester
    ? request.requesteeName
    : request.requesterName

  // What date/time to surface in the card body. Scheduled → the picked
  // instant. Otherwise → the proposed day (day mode) or the slot list
  // is rendered via ProposedSummary.
  const showScheduled =
    request.status === 'scheduled' && request.selectedStartsAt

  return (
    <CardShell>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={`text-xs font-medium ${t.text}`}>{request.title}</p>
        <span className={`text-[10px] ${t.textMuted}`}>
          {STATUS_LABEL[request.status]}
        </span>
      </div>
      <p className={`mb-1 text-[10px] ${t.textMuted}`}>
        {isRequester ? 'With' : 'From'} {counterpartyName} ·{' '}
        {request.durationMin} min
      </p>
      {showScheduled ? (
        <p className={`mb-1 text-[11px] ${t.text}`}>
          {fmtDateTime(request.selectedStartsAt!)}
        </p>
      ) : (
        <ProposedSummary request={request} />
      )}
      {request.meetLink && (
        <a
          href={request.meetLink}
          target="_blank"
          rel="noreferrer"
          className={`mb-1 inline-block text-[11px] text-teal-600 hover:underline`}
        >
          Join Google Meet
        </a>
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
      {canCancel && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={cancel}
            disabled={busy}
            className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.btn}`}
          >
            Cancel
          </button>
        </div>
      )}
    </CardShell>
  )
}
