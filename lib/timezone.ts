// Shared formatters so the in-app meeting UI matches what we send in
// emails. Always render meeting times in the *viewer's* saved IANA
// timezone (from members.timezone). Falls back to the browser default
// when the viewer has none on file.

export function formatTimeIn(
  date: Date | string,
  tz: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit'
  }
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    ...opts,
    timeZone: tz ?? undefined
  }).format(d)
}

export function formatDateTimeIn(
  date: Date | string,
  tz: string | null | undefined
): string {
  return formatTimeIn(date, tz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatDayIn(
  date: Date | string,
  tz: string | null | undefined
): string {
  return formatTimeIn(date, tz, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

// Short timezone abbreviation for the supplied moment (handles DST
// automatically because it's resolved per-date).
export function tzAbbrev(
  date: Date | string,
  tz: string | null | undefined
): string | null {
  if (!tz) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short'
    }).formatToParts(d)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null
  } catch {
    return null
  }
}

// Minute-offset for the supplied instant in the given IANA zone.
// East-of-UTC is positive. Uses Intl rather than Date so historical
// DST transitions stay correct.
function offsetMinutesAt(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  )
  return Math.round((asUtc - date.getTime()) / 60_000)
}

// Difference between two timezones at a given moment, formatted as a
// short human string. Returns null when we don't have both zones.
//   tzAhead positive  = `theirs` is east of `viewer` (their day starts sooner)
//   "+2h", "+30m", "-1h 30m", "same time"
export function formatTzDiff(
  date: Date,
  viewerTz: string | null | undefined,
  theirTz: string | null | undefined
): string | null {
  if (!viewerTz || !theirTz) return null
  if (viewerTz === theirTz) return 'same time'
  try {
    const diff =
      offsetMinutesAt(date, theirTz) - offsetMinutesAt(date, viewerTz)
    if (diff === 0) return 'same time'
    const sign = diff > 0 ? '+' : '-'
    const abs = Math.abs(diff)
    const h = Math.floor(abs / 60)
    const m = abs % 60
    if (h && m) return `${sign}${h}h ${m}m`
    if (h) return `${sign}${h}h`
    return `${sign}${m}m`
  } catch {
    return null
  }
}
