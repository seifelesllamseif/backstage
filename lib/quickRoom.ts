const MALTA = 'Europe/Malta'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Window: Mon..Fri, 07:00 to 18:00 Malta time
// (work hours 08:00..17:00 plus 1hr buffer either side).
const OPEN_HOUR = 7
const CLOSE_HOUR = 18

interface MaltaParts {
  weekdayIdx: number
  hour: number
  minute: number
}

function maltaParts(date: Date): MaltaParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MALTA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const weekdayIdx = WEEKDAYS.indexOf(get('weekday'))
  return {
    weekdayIdx,
    hour: Number(get('hour')),
    minute: Number(get('minute'))
  }
}

export interface QuickRoomWindow {
  open: boolean
  // Friendly label: "Opens Monday at 7:00" / "Closes at 18:00"
  label: string
}

export function isQuickRoomOpen(date: Date = new Date()): QuickRoomWindow {
  const { weekdayIdx, hour } = maltaParts(date)
  const isWeekday = weekdayIdx >= 1 && weekdayIdx <= 5
  const inHours = hour >= OPEN_HOUR && hour < CLOSE_HOUR
  if (isWeekday && inHours) {
    return { open: true, label: `Closes at ${CLOSE_HOUR}:00 Malta time` }
  }
  // Pick the next weekday-with-window from today's Malta-weekday vantage.
  // If we're pre-open on a weekday, the next opening is today.
  let daysAhead = 0
  if (isWeekday && hour < OPEN_HOUR) {
    daysAhead = 0
  } else {
    // After-hours weekday OR weekend: walk forward until we hit Mon..Fri.
    let probe = weekdayIdx
    daysAhead = 1
    while (true) {
      probe = (probe + 1) % 7
      if (probe >= 1 && probe <= 5) break
      daysAhead++
    }
  }
  const nextWeekdayIdx = (weekdayIdx + daysAhead) % 7
  const nextDayName =
    daysAhead === 0
      ? 'today'
      : daysAhead === 1
        ? 'tomorrow'
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextWeekdayIdx]
  return {
    open: false,
    label: `Opens ${nextDayName} at ${OPEN_HOUR}:00 Malta time`
  }
}
