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

// Deletes an event from the scheduler's primary calendar. Used when a
// meeting gets rescheduled (the old event would otherwise linger as an
// orphan with a Meet link no one's joining) or canceled. sendUpdates=all
// tells Google to email the attendees a cancellation notice.
//
// Best-effort: callers ignore the result so a Google outage never
// blocks the local state change. Logs to the server for diagnosis.
export async function deleteCalendarEvent(
  companyId: string,
  eventId: string
): Promise<{ ok: true } | { error: string }> {
  if (!eventId) return { ok: true }
  const token = await getSchedulerAccessToken(companyId)
  if ('error' in token) return { error: token.error }

  const url = `${EVENTS_URL('primary')}/${encodeURIComponent(eventId)}?sendUpdates=all`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token.accessToken}`
    }
  })

  // 204 = success. 410 = already gone (treat as success - the event
  // was probably deleted on the Google side already). Anything else
  // is reported.
  if (res.status === 204 || res.status === 410) {
    await markSchedulerUsed(companyId)
    return { ok: true }
  }
  const text = await res.text()
  return {
    error: `Calendar API delete error (${res.status}): ${text.slice(0, 200)}`
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
