// Time-scope helper for the Copy buttons. Buckets ISO timestamps or
// 'YYYY-MM-DD' dates by day, week, and month relative to "now".
//
// Weeks are Mon-Sun (ISO style). Months are calendar months in the user's
// local timezone. We intentionally do NOT use UTC for the week / month
// boundaries because the user thinks in their local calendar; using UTC
// would mean "this week" rolls over at midnight UTC, which feels wrong.

export type TimeScope = 'today' | 'week' | 'month' | 'all' | 'cycle'

export interface TimeScopeOption {
  id: TimeScope
  label: string
}

export const TIME_SCOPE_OPTIONS: TimeScopeOption[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
  { id: 'cycle', label: 'By sprint' },
]

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  // Monday as week start. JS getDay() returns 0=Sun..6=Sat.
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  return start
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // BoardTask.createdAt is 'YYYY-MM-DD'. ISO timestamps work too.
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isInScope(
  value: string | Date | null | undefined,
  scope: Exclude<TimeScope, 'all' | 'cycle'>,
  now: Date = new Date()
): boolean {
  const d = parseDate(value)
  if (!d) return false
  if (scope === 'today') return d >= startOfDay(now)
  if (scope === 'week') return d >= startOfWeek(now)
  if (scope === 'month') return d >= startOfMonth(now)
  return true
}

export function scopeLabel(scope: TimeScope): string {
  return TIME_SCOPE_OPTIONS.find((o) => o.id === scope)?.label ?? scope
}
