'use client'

import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Video } from 'lucide-react'
import { useDashTheme } from './theme'

// Week-grid view of meetings. Days as columns; meetings as compact
// blocks sorted by time within each column. Used by both the inline
// Meetings sheet "Calendar" tab and the dedicated MeetingsPanel.
//
// Why a week strip + per-day cards (not a precise hour grid): a 24-hour
// timeline grid takes ~2x the code and adds little for a workspace
// where most meetings are short and people only need to scan the day.

export interface MeetingsCalendarItem {
  id: string
  title: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'declined'
    | 'scheduled'
    | 'canceled'
    | 'completed'
  mode: 'day' | 'slots'
  durationMin: number
  // Group meetings have selectedStartsAt set at create. 1:1 scheduled
  // also have it. 1:1 pending day-mode have proposedDate (we bucket
  // them by date but not time).
  proposedDate: string | null
  selectedStartsAt: string | null
  requesterName: string
  attendees: { fullName: string }[]
  meetLink: string | null
}

export function MeetingsCalendar({
  items,
  focusedId,
  onSelect
}: {
  items: MeetingsCalendarItem[]
  focusedId?: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useDashTheme()
  // weekOffset 0 = this week, -1 = last week, +1 = next week. We always
  // anchor the strip to Monday of the chosen week.
  const [weekOffset, setWeekOffset] = useState(0)

  const week = useMemo(() => buildWeek(weekOffset), [weekOffset])

  // Group items by ISO date (yyyy-mm-dd). Items with selectedStartsAt
  // are bucketed by that day; 1:1 day-mode pending items use
  // proposedDate. Skip items with neither (shouldn't happen, but be
  // defensive).
  const byDay = useMemo(() => {
    const map = new Map<string, MeetingsCalendarItem[]>()
    for (const item of items) {
      const dayKey = bucketKey(item)
      if (!dayKey) continue
      const list = map.get(dayKey) ?? []
      list.push(item)
      map.set(dayKey, list)
    }
    // Sort each day's list by time (selectedStartsAt first, undated at end).
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aT = a.selectedStartsAt ?? ''
        const bT = b.selectedStartsAt ?? ''
        return aT.localeCompare(bT)
      })
    }
    return map
  }, [items])

  return (
    <div className="flex flex-col gap-3">
      {/* Header: week selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className={`flex size-7 items-center justify-center rounded-md border ${t.border} ${t.btn}`}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.border} ${t.btn}`}
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className={`flex size-7 items-center justify-center rounded-md border ${t.border} ${t.btn}`}
            aria-label="Next week"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <span className={`text-[10px] tracking-wider uppercase ${t.textMuted}`}>
          {weekLabel(week)}
        </span>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const key = d.iso
          const dayItems = byDay.get(key) ?? []
          const isToday = key === todayIso()
          return (
            <div
              key={key}
              className={`flex min-h-32 flex-col gap-1 rounded-md border p-1.5 ${t.border} ${isToday ? 'bg-teal-500/5' : ''}`}
            >
              <div className="mb-0.5 flex items-baseline justify-between">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  {d.weekday}
                </span>
                <span
                  className={`text-[11px] font-medium ${isToday ? 'text-teal-700' : t.text}`}
                >
                  {d.dayNum}
                </span>
              </div>
              {dayItems.length === 0 ? (
                <span
                  className={`text-[10px] italic ${t.textSubtle} mt-1`}
                >
                  —
                </span>
              ) : (
                dayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`group flex flex-col items-start gap-0.5 rounded-md border px-1.5 py-1 text-left transition hover:bg-teal-500/10 ${t.border} ${
                      item.id === focusedId ? 'ring-2 ring-teal-500' : ''
                    } ${statusTint(item.status)}`}
                  >
                    <span className={`text-[10px] tabular-nums ${t.textMuted}`}>
                      {formatTime(item.selectedStartsAt)}
                      {item.meetLink && (
                        <Video className="inline-block ml-1 size-2.5 align-text-bottom" />
                      )}
                    </span>
                    <span
                      className={`line-clamp-2 text-[11px] leading-tight ${t.text}`}
                    >
                      {item.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          )
        })}
      </div>

      {items.length === 0 && (
        <div
          className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-[11px] ${t.border} ${t.textSubtle}`}
        >
          <Calendar className="size-3.5" />
          No meetings scheduled. Request one from any teammate.
        </div>
      )}
    </div>
  )
}

interface WeekDay {
  date: Date
  iso: string
  weekday: string
  dayNum: number
}

// Anchor on Monday of the chosen week (weekOffset relative to this
// week). Returns 7 days, Mon-Sun.
function buildWeek(offset: number): WeekDay[] {
  const now = new Date()
  // ISO weekday: Mon=1 ... Sun=7. JS getDay: Sun=0 ... Sat=6.
  const jsDay = now.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - (isoDay - 1) + offset * 7)

  const out: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    out.push({
      date: d,
      iso: isoDateKey(d),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate()
    })
  }
  return out
}

function weekLabel(week: WeekDay[]): string {
  if (week.length === 0) return ''
  const first = week[0].date
  const last = week[6].date
  const sameMonth = first.getMonth() === last.getMonth()
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (sameMonth) {
    return `${first.toLocaleDateString('en-US', { month: 'short' })} ${first.getDate()} - ${last.getDate()}`
  }
  return `${first.toLocaleDateString('en-US', opts)} - ${last.toLocaleDateString('en-US', opts)}`
}

function isoDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayIso(): string {
  return isoDateKey(new Date())
}

function bucketKey(item: MeetingsCalendarItem): string | null {
  if (item.selectedStartsAt) {
    return isoDateKey(new Date(item.selectedStartsAt))
  }
  if (item.proposedDate) return item.proposedDate
  return null
}

function formatTime(iso: string | null): string {
  if (!iso) return 'all day'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(d)
}

function statusTint(status: MeetingsCalendarItem['status']): string {
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
