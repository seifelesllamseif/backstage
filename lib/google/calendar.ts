import 'server-only'

import { randomUUID } from 'crypto'
import { getSchedulerAccessToken, markSchedulerUsed } from './oauth'

// Wraps Calendar v3 events.insert. We only need event creation right
// now (to generate a Meet link + invite both parties). Cancellation
// can be wired later as a delete call.

const EVENTS_URL = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

export interface CreateCalendarEventInput {
  companyId: string
  startsAt: Date
  durationMin: number
  title: string
  description?: string | null
  attendeeEmails: string[]
}

export interface CreateCalendarEventResult {
  eventId: string
  meetLink: string | null
  htmlLink: string | null
}

interface CalendarEventResponse {
  id: string
  htmlLink?: string
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: Array<{ uri?: string; entryPointType?: string }>
  }
}

export async function createCalendarEventWithMeet(
  input: CreateCalendarEventInput
): Promise<CreateCalendarEventResult | { error: string }> {
  const token = await getSchedulerAccessToken(input.companyId)
  if ('error' in token) return { error: token.error }

  const endsAt = new Date(input.startsAt.getTime() + input.durationMin * 60_000)

  const body = {
    summary: input.title,
    description: input.description ?? undefined,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: endsAt.toISOString() },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    },
    reminders: { useDefault: true }
  }

  // conferenceDataVersion=1 is what Calendar needs to honor the Meet
  // createRequest. sendUpdates=all triggers Google's own invite emails
  // to attendees (in addition to ours).
  const url = `${EVENTS_URL('primary')}?conferenceDataVersion=1&sendUpdates=all`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    return {
      error: `Calendar API error (${res.status}): ${text.slice(0, 200)}`
    }
  }

  const data = (await res.json()) as CalendarEventResponse
  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
      ?.uri ??
    null

  await markSchedulerUsed(input.companyId)
  return {
    eventId: data.id,
    meetLink,
    htmlLink: data.htmlLink ?? null
  }
}
