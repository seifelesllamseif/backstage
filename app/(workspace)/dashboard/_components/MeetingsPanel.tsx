'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatTimeIn } from '@/lib/timezone'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  LayoutList,
  Rocket,
  Users,
  Video
} from 'lucide-react'
import { useDashTheme } from './theme'
import { useMeetingsSheet } from './MeetingsSheet'
import { useMeetingCreateWizard } from './MeetingCreateWizard'
import { usePortfolioSheet } from './PortfolioSheet'
import { useTeam } from './TeamContext'
import { listMyMeetingRequests, listPendingApprovals } from '../actions'
import type { Sprint } from './boardData'

// Full-screen calendar of meetings + sprints. Three views (month, week,
// list), a date navigator toolbar, stats cards across the top, and
// click handlers that route into the existing MeetingsSheet or
// PortfolioSheet so we don't reinvent any modals.

type ViewMode = 'month' | 'week' | 'list'

type MeetingItem = {
  kind: 'meeting'
  id: string
  title: string
  startsAt: Date | null
  endsAt: Date | null
  bucketDay: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'declined'
    | 'scheduled'
    | 'canceled'
    | 'completed'
  requesterId: string
  requesterName: string
  attendees: { id: string; fullName: string }[]
  meetLink: string | null
}

type SprintItem = {
  kind: 'sprint'
  id: string
  name: string
  number: number
  fromDate: Date
  toDate: Date
  status: 'completed' | 'current' | 'upcoming'
}

type CalendarItem = MeetingItem | SprintItem

export function MeetingsPanel({
  sprints,
  currentUserId,
  accessTier
}: {
  sprints: Sprint[]
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
}) {
  const { t } = useDashTheme()
  const meetingsSheet = useMeetingsSheet()
  const wizard = useMeetingCreateWizard()
  const { open: openPortfolio } = usePortfolioSheet()
  const team = useTeam()
  const isPlanner = accessTier === 'admin' || accessTier === 'lead'
  const viewerTz =
    team.find((m) => m.id === currentUserId)?.timezone ?? null

  const [view, setView] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))

  const mineQuery = useQuery({
    queryKey: ['meetingRequests', 'mine'],
    queryFn: async () => {
      const res = await listMyMeetingRequests()
      if ('error' in res) return []
      return res.requests
    },
    refetchInterval: 30_000
  })

  const pendingQuery = useQuery({
    queryKey: ['meetingRequests', 'pending'],
    queryFn: async () => {
      const res = await listPendingApprovals()
      if ('error' in res) return []
      return res.requests
    },
    enabled: isPlanner,
    refetchInterval: 30_000
  })

  const meetingItems: MeetingItem[] = useMemo(() => {
    const all = [...(pendingQuery.data ?? []), ...(mineQuery.data ?? [])]
    const byId = new Map<string, MeetingItem>()
    for (const r of all) {
      // Canceled / rejected / declined meetings are dead - they would
      // otherwise linger on the calendar forever and confuse "what's on
      // my schedule." History stays accessible through the inbox sheet.
      if (
        r.status === 'canceled' ||
        r.status === 'rejected' ||
        r.status === 'declined'
      )
        continue
      const startsAt = r.selectedStartsAt ? new Date(r.selectedStartsAt) : null
      const endsAt = startsAt
        ? new Date(startsAt.getTime() + r.durationMin * 60_000)
        : null
      const bucketDay = startsAt
        ? isoDateKey(startsAt)
        : r.proposedDate ?? ''
      if (!bucketDay) continue
      byId.set(r.id, {
        kind: 'meeting',
        id: r.id,
        title: r.title,
        startsAt,
        endsAt,
        bucketDay,
        status: r.status,
        requesterId: r.requesterId,
        requesterName: r.requesterName,
        attendees: r.attendees.map((a) => ({ id: a.id, fullName: a.fullName })),
        meetLink: r.meetLink
      })
    }
    return Array.from(byId.values())
  }, [pendingQuery.data, mineQuery.data])

  const sprintItems: SprintItem[] = useMemo(
    () =>
      sprints.map((s) => ({
        kind: 'sprint' as const,
        id: s.id,
        name: s.name,
        number: s.number,
        fromDate: new Date(s.fromIso),
        toDate: new Date(s.toIso),
        status: s.status
      })),
    [sprints]
  )

  const loading = mineQuery.isLoading || (isPlanner && pendingQuery.isLoading)

  function openMember(memberId: string) {
    if (memberId === currentUserId) {
      openPortfolio(currentUserId)
      return
    }
    if (team.some((m) => m.id === memberId)) {
      openPortfolio(memberId)
    }
  }

  function openMeeting(id: string) {
    meetingsSheet.open({ focusedRequestId: id })
  }

  // Counts driving the Stats cards. inWeek = meetings whose bucket falls
  // inside the current week (anchor's week). Sprint events don't get
  // counted in stats - they're context decoration, not "things to do".
  const inWeekCount = useMemo(() => {
    const week = weekDays(anchor)
    const keys = new Set(week.map((d) => isoDateKey(d)))
    return meetingItems.filter((m) => keys.has(m.bucketDay)).length
  }, [meetingItems, anchor])

  // Stats come from the raw query union, NOT meetingItems. The
  // calendar grid (meetingItems) drops rows that have no bucketDay -
  // e.g. pending slots-mode meetings whose proposedDate is null
  // because the requester offered specific times instead of a day -
  // but those still need to count towards "Pending approval" etc.
  const statRows = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; status: string; requesterId: string; attendees: { id: string }[] }[] = []
    for (const r of [...(pendingQuery.data ?? []), ...(mineQuery.data ?? [])]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push({
        id: r.id,
        status: r.status,
        requesterId: r.requesterId,
        attendees: r.attendees.map((a) => ({ id: a.id }))
      })
    }
    return out
  }, [pendingQuery.data, mineQuery.data])

  const scheduledCount = statRows.filter((m) => m.status === 'scheduled').length
  const awaitingPickCount = statRows.filter(
    (m) =>
      m.status === 'approved' &&
      m.attendees.length === 1 &&
      m.attendees[0]?.id === currentUserId
  ).length
  const pendingCount = statRows.filter((m) => m.status === 'pending').length
  // Meetings where I was a participant, status still 'scheduled', and
  // the scheduled end-time is already past. Drives the new "Awaiting
  // your review" stat card and the inbox section.
  const awaitingReviewCount = useMemo(() => {
    const now = Date.now()
    return meetingItems.filter((m) => {
      if (m.status !== 'scheduled') return false
      if (!m.startsAt || !m.endsAt) return false
      if (m.endsAt.getTime() > now) return false
      const isParticipant =
        m.requesterId === currentUserId ||
        m.attendees.some((a) => a.id === currentUserId)
      return isParticipant
    }).length
  }, [meetingItems, currentUserId])

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`text-lg font-medium ${t.text}`}>Meetings calendar</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => meetingsSheet.open()}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
          >
            Open inbox
          </button>
          <button
            onClick={() => wizard.open()}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md bg-teal-600 px-2.5 text-[11px] font-medium text-white transition hover:bg-teal-700`}
          >
            <CalendarPlus className="size-3.5" /> New meeting
          </button>
        </div>
      </div>

      <Stats
        scheduled={scheduledCount}
        awaitingPick={awaitingPickCount}
        pending={pendingCount}
        inWeek={inWeekCount}
        awaitingReview={awaitingReviewCount}
        onShowScheduled={() => meetingsSheet.open({ focus: 'scheduled' })}
        onShowAwaiting={() => meetingsSheet.open({ focus: 'awaiting' })}
        onShowPending={() => meetingsSheet.open({ focus: 'pending' })}
        onShowReview={() => meetingsSheet.open({ focus: 'review' })}
        onJumpToWeek={() => {
          setView('week')
          setAnchor(startOfDay(new Date()))
        }}
      />

      <Toolbar
        view={view}
        setView={setView}
        anchor={anchor}
        setAnchor={setAnchor}
      />

      {loading && meetingItems.length === 0 && (
        <div
          className={`mt-4 rounded-md border p-10 text-center text-[11px] italic ${t.border} ${t.textSubtle}`}
        >
          Loading...
        </div>
      )}

      {!loading && meetingItems.length === 0 && sprintItems.length === 0 && (
        <div
          className={`mt-4 rounded-md border p-10 text-center text-[11px] ${t.border} ${t.textSubtle}`}
        >
          No meetings or sprints to show. Request one from any teammate.
        </div>
      )}

      <div className="mt-4">
        {view === 'month' && (
          <MonthView
            anchor={anchor}
            meetings={meetingItems}
            sprints={sprintItems}
            viewerTz={viewerTz}
            onSelectMeeting={openMeeting}
          />
        )}
        {view === 'week' && (
          <WeekView
            anchor={anchor}
            meetings={meetingItems}
            sprints={sprintItems}
            currentUserId={currentUserId}
            viewerTz={viewerTz}
            onSelectMeeting={openMeeting}
            onSelectMember={openMember}
          />
        )}
        {view === 'list' && (
          <ListView
            meetings={meetingItems}
            currentUserId={currentUserId}
            viewerTz={viewerTz}
            onSelectMeeting={openMeeting}
            onSelectMember={openMember}
          />
        )}
      </div>

      <Legend />
    </div>
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────

function Stats({
  scheduled,
  awaitingPick,
  pending,
  inWeek,
  awaitingReview,
  onShowScheduled,
  onShowAwaiting,
  onShowPending,
  onShowReview,
  onJumpToWeek
}: {
  scheduled: number
  awaitingPick: number
  pending: number
  inWeek: number
  awaitingReview: number
  onShowScheduled: () => void
  onShowAwaiting: () => void
  onShowPending: () => void
  onShowReview: () => void
  onJumpToWeek: () => void
}) {
  const { t } = useDashTheme()
  const cards: {
    label: string
    value: number
    tone: string
    onClick: () => void
    title: string
  }[] = [
    {
      label: 'Scheduled',
      value: scheduled,
      tone: 'text-emerald-600',
      onClick: onShowScheduled,
      title: 'Show only scheduled meetings'
    },
    {
      label: 'In this week',
      value: inWeek,
      tone: 'text-teal-600',
      onClick: onJumpToWeek,
      title: 'Jump to this week in the week view'
    },
    {
      label: 'Awaiting your pick',
      value: awaitingPick,
      tone: 'text-amber-600',
      onClick: onShowAwaiting,
      title: 'Show only meetings awaiting your pick'
    },
    {
      label: 'Pending approval',
      value: pending,
      tone: 'text-sky-600',
      onClick: onShowPending,
      title: 'Show only meetings pending approval'
    }
  ]
  if (awaitingReview > 0) {
    cards.push({
      label: 'Awaiting review',
      value: awaitingReview,
      tone: 'text-rose-600',
      onClick: onShowReview,
      title: 'Past meetings that need a quick outcome note'
    })
  }
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={c.onClick}
          title={c.title}
          className={`rounded-lg border p-3 text-left transition hover:bg-teal-500/5 hover:border-teal-500/40 ${t.border}`}
        >
          <div className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
            {c.label}
          </div>
          <div className={`mt-1 text-2xl font-semibold ${c.tone}`}>
            {c.value}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────

function Toolbar({
  view,
  setView,
  anchor,
  setAnchor
}: {
  view: ViewMode
  setView: (v: ViewMode) => void
  anchor: Date
  setAnchor: (d: Date) => void
}) {
  const { t } = useDashTheme()

  function stepBy(days: number) {
    const next = new Date(anchor)
    next.setDate(next.getDate() + days)
    setAnchor(startOfDay(next))
  }

  function stepMonth(delta: number) {
    const next = new Date(anchor)
    next.setMonth(next.getMonth() + delta)
    setAnchor(startOfDay(next))
  }

  const label =
    view === 'month'
      ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : view === 'week'
        ? weekLabel(anchor)
        : 'Upcoming'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => (view === 'month' ? stepMonth(-1) : stepBy(-7))}
          aria-label="Previous"
          className={`flex size-7 items-center justify-center rounded-md border ${t.border} ${t.btn}`}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          onClick={() => setAnchor(startOfDay(new Date()))}
          className={`h-7 rounded-md border px-2 text-[11px] ${t.border} ${t.btn}`}
        >
          Today
        </button>
        <button
          onClick={() => (view === 'month' ? stepMonth(1) : stepBy(7))}
          aria-label="Next"
          className={`flex size-7 items-center justify-center rounded-md border ${t.border} ${t.btn}`}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <span className={`ml-2 text-[11px] ${t.textMuted}`}>{label}</span>
      </div>
      <div
        className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
      >
        <ToolbarTab
          active={view === 'month'}
          onClick={() => setView('month')}
          icon={<LayoutGrid className="size-3" />}
          label="Month"
        />
        <ToolbarTab
          active={view === 'week'}
          onClick={() => setView('week')}
          icon={<CalendarDays className="size-3" />}
          label="Week"
        />
        <ToolbarTab
          active={view === 'list'}
          onClick={() => setView('list')}
          icon={<LayoutList className="size-3" />}
          label="List"
        />
      </div>
    </div>
  )
}

function ToolbarTab({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] transition ${active ? t.tabActive : t.tab}`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Month view ──────────────────────────────────────────────────────────

function MonthView({
  anchor,
  meetings,
  sprints,
  viewerTz,
  onSelectMeeting
}: {
  anchor: Date
  meetings: MeetingItem[]
  sprints: SprintItem[]
  viewerTz: string | null
  onSelectMeeting: (id: string) => void
}) {
  const { t } = useDashTheme()
  // 6 weeks * 7 days = 42 cells, starting on the Monday on or before
  // the 1st of anchor's month. Lets the calendar always be a stable 6
  // rows regardless of where the month starts.
  const cells = useMemo(() => buildMonthGrid(anchor), [anchor])
  const monthIdx = anchor.getMonth()

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>()
    for (const m of meetings) {
      const list = map.get(m.bucketDay) ?? []
      list.push(m)
      map.set(m.bucketDay, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)
      )
    }
    return map
  }, [meetings])

  return (
    <div
      className={`overflow-hidden rounded-lg border ${t.border}`}
    >
      <div className="grid grid-cols-7">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className={`border-b px-2 py-1.5 text-[9px] tracking-wider uppercase ${t.border} ${t.textMuted}`}
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const key = isoDateKey(day)
          const isOtherMonth = day.getMonth() !== monthIdx
          const isToday = key === isoDateKey(new Date())
          const dayMeetings = meetingsByDay.get(key) ?? []
          const sprintsHere = sprints.filter(
            (s) => day >= startOfDay(s.fromDate) && day <= startOfDay(s.toDate)
          )
          return (
            <div
              key={i}
              className={`relative flex min-h-24 flex-col gap-0.5 border-r border-b p-1.5 ${t.border} ${isOtherMonth ? 'opacity-50' : ''} ${isToday ? 'bg-teal-500/5' : ''}`}
            >
              <div className="mb-0.5 flex items-baseline justify-between">
                <span
                  className={`text-[11px] ${isToday ? 'font-semibold text-teal-700' : t.text}`}
                >
                  {day.getDate()}
                </span>
                {isToday && <TodayChip />}
              </div>
              {/* Sprint bars (date-range overlays) */}
              {sprintsHere.map((s) => (
                <div
                  key={s.id}
                  title={`Sprint ${s.number}: ${s.name}`}
                  className={`flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-[9px] ${sprintTint(s.status)}`}
                >
                  <Rocket className="size-2.5 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </div>
              ))}
              {dayMeetings.slice(0, 3).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectMeeting(m.id)}
                  className={`flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left text-[10px] transition hover:bg-teal-500/10 ${statusTint(m.status)}`}
                >
                  <span className={`tabular-nums ${t.textMuted}`}>
                    {m.startsAt ? formatTimeIn(m.startsAt, viewerTz) : '·'}
                  </span>
                  <span className="truncate">{m.title}</span>
                </button>
              ))}
              {dayMeetings.length > 3 && (
                <span
                  className={`text-[9px] tabular-nums ${t.textSubtle}`}
                >
                  +{dayMeetings.length - 3} more
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week view ───────────────────────────────────────────────────────────

// Hour grid: 6:00 to 23:00 inclusive. Row height is fixed so the
// absolute-positioned event blocks can compute their top/height from
// the start time and duration without measuring the DOM.
const GRID_START_HOUR = 6
const GRID_END_HOUR = 23
const GRID_ROW_PX = 48
const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => GRID_START_HOUR + i
)

function WeekView({
  anchor,
  meetings,
  sprints,
  viewerTz,
  onSelectMeeting
}: {
  anchor: Date
  meetings: MeetingItem[]
  sprints: SprintItem[]
  currentUserId: string
  viewerTz: string | null
  onSelectMeeting: (id: string) => void
  onSelectMember: (id: string) => void
}) {
  const { t } = useDashTheme()
  const days = useMemo(() => weekDays(anchor), [anchor])
  const todayKey = isoDateKey(new Date())

  const timedByDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>()
    for (const m of meetings) {
      if (!m.startsAt) continue
      const list = map.get(m.bucketDay) ?? []
      list.push(m)
      map.set(m.bucketDay, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)
      )
    }
    return map
  }, [meetings])

  // Day-mode pending meetings have no time yet. Show them above the
  // hour grid so they stay visible without overlapping real timed slots.
  const untimedByDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>()
    for (const m of meetings) {
      if (m.startsAt) continue
      const list = map.get(m.bucketDay) ?? []
      list.push(m)
      map.set(m.bucketDay, list)
    }
    return map
  }, [meetings])

  return (
    <div
      className={`overflow-hidden rounded-lg border ${t.border} ${t.surface}`}
    >
      {/* Day header */}
      <div
        className={`grid border-b ${t.border}`}
        style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}
      >
        <div
          className={`px-2 py-2 text-[9px] tracking-wider uppercase ${t.textMuted}`}
        >
          Time
        </div>
        {days.map((day) => {
          const key = isoDateKey(day)
          const isToday = key === todayKey
          const sprintsHere = sprints.filter(
            (s) => day >= startOfDay(s.fromDate) && day <= startOfDay(s.toDate)
          )
          return (
            <div
              key={key}
              className={`flex flex-col items-center gap-1 border-l px-2 py-2 ${t.border} ${isToday ? 'bg-teal-500/10' : ''}`}
            >
              <span
                className={`text-[10px] tracking-wider uppercase ${isToday ? 'text-teal-700' : t.textMuted}`}
              >
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span
                className={`text-base font-medium ${isToday ? 'text-teal-700' : t.text}`}
              >
                {day.getDate()}
              </span>
              <div className="flex items-center gap-1">
                {sprintsHere.map((s) => (
                  <span
                    key={s.id}
                    title={`Sprint ${s.number}: ${s.name}`}
                    className={`inline-flex size-4 items-center justify-center rounded ${sprintTint(s.status)}`}
                  >
                    <Rocket className="size-2.5" />
                  </span>
                ))}
                {isToday && <TodayChip />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Untimed meetings: only render the row when at least one day has one */}
      {Array.from(untimedByDay.values()).some((list) => list.length > 0) && (
        <div
          className={`grid border-b ${t.border}`}
          style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}
        >
          <div
            className={`px-2 py-1.5 text-[9px] tracking-wider uppercase ${t.textMuted}`}
          >
            All-day
          </div>
          {days.map((day) => {
            const key = isoDateKey(day)
            const isToday = key === todayKey
            const untimed = untimedByDay.get(key) ?? []
            return (
              <div
                key={key}
                className={`flex min-h-8 flex-col gap-0.5 border-l p-1 ${t.border} ${isToday ? 'bg-teal-500/5' : ''}`}
              >
                {untimed.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelectMeeting(m.id)}
                    className={`flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left text-[10px] transition hover:bg-teal-500/10 ${statusTint(m.status)}`}
                    title={m.title}
                  >
                    <span className={`tabular-nums ${t.textMuted}`}>·</span>
                    <span className="truncate">{m.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Hour grid */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: '4rem repeat(7, minmax(0, 1fr))' }}
      >
        {/* Time axis */}
        <div>
          {GRID_HOURS.map((h) => (
            <div
              key={h}
              className={`flex items-start justify-end border-b pt-0.5 pr-2 text-[10px] tabular-nums ${t.border} ${t.textMuted}`}
              style={{ height: `${GRID_ROW_PX}px` }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const key = isoDateKey(day)
          const isToday = key === todayKey
          const timed = timedByDay.get(key) ?? []
          return (
            <div
              key={key}
              className={`relative border-l ${t.border} ${isToday ? 'bg-teal-500/5' : ''}`}
            >
              {GRID_HOURS.map((h) => (
                <div
                  key={h}
                  className={`border-b ${t.border}`}
                  style={{ height: `${GRID_ROW_PX}px` }}
                />
              ))}
              {timed.map((m) => {
                const pos = positionEvent(m)
                if (!pos) return null
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectMeeting(m.id)}
                    className={`absolute right-1 left-1 z-10 flex flex-col items-start gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition hover:opacity-90 ${t.border} ${statusTint(m.status)}`}
                    style={pos}
                    title={m.title}
                  >
                    <span
                      className={`text-[10px] tabular-nums ${t.textMuted}`}
                    >
                      {m.startsAt && formatTimeIn(m.startsAt, viewerTz)}
                      {m.meetLink && m.status === 'scheduled' && (
                        <Video className="ml-1 inline-block size-2.5 text-teal-600" />
                      )}
                    </span>
                    <span
                      className={`line-clamp-2 text-[11px] leading-tight ${t.text}`}
                    >
                      {m.title}
                    </span>
                  </button>
                )
              })}
              {isToday && <NowLine />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function positionEvent(m: MeetingItem): React.CSSProperties | null {
  if (!m.startsAt) return null
  const start = m.startsAt
  const end = m.endsAt ?? new Date(start.getTime() + 30 * 60_000)
  const sh = start.getHours() + start.getMinutes() / 60
  const eh = end.getHours() + end.getMinutes() / 60
  const clampedStart = Math.max(sh, GRID_START_HOUR)
  const clampedEnd = Math.min(Math.max(eh, clampedStart + 0.25), GRID_END_HOUR + 1)
  const top = (clampedStart - GRID_START_HOUR) * GRID_ROW_PX
  const height = (clampedEnd - clampedStart) * GRID_ROW_PX
  return { top: `${top}px`, height: `${height}px` }
}

function formatHourLabel(h: number): string {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true
  }).format(d)
}

// Thin red line at the current time, visible only on today's column
// and only when "now" falls inside the visible 6:00 - 23:00 window.
function NowLine() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const hours = now.getHours() + now.getMinutes() / 60
  if (hours < GRID_START_HOUR || hours > GRID_END_HOUR + 1) return null
  const top = (hours - GRID_START_HOUR) * GRID_ROW_PX
  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-20"
      style={{ top: `${top}px` }}
    >
      <div className="relative h-px bg-rose-500/80">
        <span className="absolute -top-1 -left-1 inline-block size-2 rounded-full bg-rose-500" />
      </div>
    </div>
  )
}

function TodayChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-medium text-teal-700">
      Today
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
      </span>
    </span>
  )
}

// ─── List view ───────────────────────────────────────────────────────────

function ListView({
  meetings,
  currentUserId,
  viewerTz,
  onSelectMeeting,
  onSelectMember
}: {
  meetings: MeetingItem[]
  currentUserId: string
  viewerTz: string | null
  onSelectMeeting: (id: string) => void
  onSelectMember: (id: string) => void
}) {
  const { t } = useDashTheme()
  const sorted = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const aT = a.startsAt?.getTime() ?? Date.parse(a.bucketDay) ?? 0
      const bT = b.startsAt?.getTime() ?? Date.parse(b.bucketDay) ?? 0
      return aT - bT
    })
  }, [meetings])
  if (sorted.length === 0) {
    return (
      <div
        className={`rounded-lg border p-10 text-center text-[11px] ${t.border} ${t.textSubtle}`}
      >
        Nothing to show.
      </div>
    )
  }
  return (
    <div className={`overflow-hidden rounded-lg border ${t.border}`}>
      <ul className="divide-y">
        {sorted.map((m) => (
          <li
            key={m.id}
            className={`flex items-start justify-between gap-3 p-3 ${t.border}`}
          >
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onSelectMeeting(m.id)}
                className={`text-left text-xs font-medium ${t.text} hover:underline`}
              >
                {m.title}
              </button>
              <div className={`mt-0.5 flex flex-wrap gap-x-2 text-[10px] ${t.textMuted}`}>
                <MemberLink
                  id={m.requesterId}
                  name={m.requesterName}
                  onSelectMember={onSelectMember}
                />
                <span>→</span>
                {m.attendees.map((a) => (
                  <MemberLink
                    key={a.id}
                    id={a.id}
                    name={a.fullName}
                    onSelectMember={onSelectMember}
                  />
                ))}
                {m.startsAt && (
                  <span className="tabular-nums">
                    · {formatFullDateTime(m.startsAt, viewerTz)}
                  </span>
                )}
                <span className={`uppercase tracking-wider ${t.textSubtle}`}>
                  · {m.status}
                </span>
              </div>
            </div>
            {m.meetLink && m.status === 'scheduled' && (
              <a
                href={m.meetLink}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] text-teal-700 ${t.border}`}
              >
                <Video className="size-3" /> Join
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Reusable bits ───────────────────────────────────────────────────────

function MemberLink({
  id,
  name,
  onSelectMember,
  subtle
}: {
  id: string
  name: string
  onSelectMember: (id: string) => void
  subtle?: boolean
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onSelectMember(id)
      }}
      className={`hover:underline ${subtle ? t.textSubtle : t.textMuted}`}
    >
      {name}
    </button>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────

function Legend() {
  const { t } = useDashTheme()
  return (
    <div className={`mt-4 rounded-lg border p-3 ${t.border}`}>
      <div
        className={`mb-2 flex items-center gap-1.5 text-[9px] tracking-wider uppercase ${t.textMuted}`}
      >
        <Clock className="size-3" />
        Legend
      </div>
      <div className="flex flex-wrap gap-3 text-[10px]">
        <LegendChip swatch="bg-amber-500/20" label="Pending approval" />
        <LegendChip swatch="bg-sky-500/20" label="Approved - waiting pick" />
        <LegendChip swatch="bg-emerald-500/20" label="Scheduled" />
        <LegendChip swatch="bg-zinc-500/10" label="Completed / done" />
        <LegendChip
          swatch="bg-teal-500/20"
          label="Active sprint"
          icon={<Rocket className="size-3" />}
        />
        <LegendChip swatch="bg-zinc-200" label="Upcoming sprint" />
        <span className={`inline-flex items-center gap-1 ${t.textMuted}`}>
          <Users className="size-3" /> click any name to peek their profile
        </span>
      </div>
    </div>
  )
}

function LegendChip({
  swatch,
  label,
  icon
}: {
  swatch: string
  label: string
  icon?: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`flex size-3 items-center justify-center rounded-sm ${swatch}`}>
        {icon}
      </span>
      <span className={t.textMuted}>{label}</span>
    </span>
  )
}

// ─── Date helpers ────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const next = new Date(d)
  next.setHours(0, 0, 0, 0)
  return next
}

function isoDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Build a 6x7 grid anchored on the Monday on-or-before the 1st of
// anchor's month. Always 42 cells.
function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const jsDay = first.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay
  const start = new Date(first)
  start.setDate(first.getDate() - (isoDay - 1))
  start.setHours(0, 0, 0, 0)
  const out: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(d)
  }
  return out
}

function weekDays(anchor: Date): Date[] {
  const jsDay = anchor.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay
  const monday = new Date(anchor)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(anchor.getDate() - (isoDay - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function weekLabel(anchor: Date): string {
  const days = weekDays(anchor)
  const first = days[0]
  const last = days[6]
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString('en-US', { month: 'short' })} ${first.getDate()} - ${last.getDate()}`
  }
  return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function formatFullDateTime(d: Date, viewerTz: string | null): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz ?? undefined,
    timeZoneName: 'short',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d)
}

function statusTint(status: MeetingItem['status']): string {
  switch (status) {
    case 'scheduled':
      return 'bg-emerald-500/10'
    case 'approved':
      return 'bg-sky-500/10'
    case 'pending':
      return 'bg-amber-500/10'
    case 'completed':
      return 'bg-zinc-500/10'
    default:
      return 'bg-zinc-300/10 opacity-60'
  }
}

function sprintTint(status: SprintItem['status']): string {
  switch (status) {
    case 'current':
      return 'bg-teal-500/20 text-teal-800'
    case 'upcoming':
      return 'bg-zinc-200 text-zinc-700'
    case 'completed':
    default:
      return 'bg-zinc-100 text-zinc-500 line-through'
  }
}
