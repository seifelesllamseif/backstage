import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import { absoluteUrl, sendEmail } from '@/lib/email/send'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe'
import {
  meetingApprovedEmail,
  meetingDeclinedOrRejectedEmail,
  meetingRequestSubmittedEmail,
  meetingScheduledEmail
} from '@/lib/email/templates'
import { createCalendarEventWithMeet } from '@/lib/google/calendar'
import type { Database, Json, TablesInsert } from '@/supabase/types'

// Meeting-request server actions. Service-role only (the dashboard talks
// via createAdminClient per ADR 0032). Authorization is enforced in
// code, not at the row level.
//
// Two scheduling modes:
//   - 'day':   requester proposes a date, requestee picks a time on it.
//   - 'slots': requester proposes 2-3 specific datetimes, requestee
//              picks one.
//
// State machine:
//   pending  -> approved | rejected | canceled
//   approved -> scheduled | declined | canceled
//   scheduled -> canceled | completed

type MeetingStatus = Database['public']['Enums']['meeting_request_status']

const DATE_ONLY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use YYYY-MM-DD for the date.' })

const ISO_DATETIME = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Use an ISO datetime.'
})

const BaseCreate = z.object({
  requesteeId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  agenda: z.string().trim().max(2000).optional().nullable(),
  durationMin: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90)
  ])
})

const CreateMeetingInput = z.discriminatedUnion('mode', [
  BaseCreate.extend({
    mode: z.literal('day'),
    proposedDate: DATE_ONLY
  }),
  BaseCreate.extend({
    mode: z.literal('slots'),
    slots: z.array(ISO_DATETIME).min(2).max(3)
  })
])

export type CreateMeetingInputT = z.infer<typeof CreateMeetingInput>

export interface MeetingRequest {
  id: string
  status: MeetingStatus
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

type RawMeetingRow = Database['public']['Tables']['meeting_requests']['Row'] & {
  requester: { full_name: string } | null
  requestee: { full_name: string } | null
}

function rowToRequest(r: RawMeetingRow): MeetingRequest {
  const mode = (r.mode === 'slots' ? 'slots' : 'day') as 'day' | 'slots'
  return {
    id: r.id,
    status: r.status,
    mode,
    title: r.title,
    agenda: r.agenda,
    durationMin: r.duration_min,
    proposedDate: r.proposed_date,
    slots: Array.isArray(r.slots) ? (r.slots as string[]) : null,
    selectedStartsAt: r.selected_starts_at,
    selectedSlotIndex: r.selected_slot_index,
    meetLink: r.meet_link,
    calendarEventId: r.calendar_event_id,
    requesterId: r.requester_id,
    requesterName: r.requester?.full_name ?? 'Someone',
    requesteeId: r.requestee_id,
    requesteeName: r.requestee?.full_name ?? 'Someone',
    approvedById: r.approved_by_id,
    approvedAt: r.approved_at,
    rejectionReason: r.rejection_reason,
    declineReason: r.decline_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

const SELECT_WITH_NAMES = `*, requester:team_members!meeting_requests_requester_id_fkey(full_name), requestee:team_members!meeting_requests_requestee_id_fkey(full_name)`

// ─── Create ──────────────────────────────────────────────────────────────

export async function createMeetingRequest(
  raw: z.input<typeof CreateMeetingInput>
): Promise<{ request: MeetingRequest } | { error: string }> {
  const parsed = CreateMeetingInput.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const input = parsed.data
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (input.requesteeId === member.id) {
    return { error: "You can't request a meeting with yourself." }
  }

  const supabase = createAdminClient()
  const { data: requestee } = await supabase
    .from('team_members')
    .select('id, company_id')
    .eq('id', input.requesteeId)
    .maybeSingle()
  if (!requestee || requestee.company_id !== member.companyId) {
    return { error: 'Requestee not found in your workspace.' }
  }

  const insert: TablesInsert<'meeting_requests'> = {
    company_id: member.companyId,
    requester_id: member.id,
    requestee_id: input.requesteeId,
    title: input.title,
    agenda: input.agenda?.trim() || null,
    duration_min: input.durationMin,
    status: 'pending',
    mode: input.mode,
    proposed_date: input.mode === 'day' ? input.proposedDate : null,
    slots:
      input.mode === 'slots' ? (input.slots as unknown as Json) : null,
    selected_slot_index: null
  }

  const { data, error } = await supabase
    .from('meeting_requests')
    .insert(insert)
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not create meeting request.' }
  }

  await fanOutApprovalEmails(member.companyId, rowToRequest(data as RawMeetingRow))
  revalidatePath('/dashboard')
  return { request: rowToRequest(data as RawMeetingRow) }
}

// ─── List ────────────────────────────────────────────────────────────────

export async function listMyMeetingRequests(): Promise<
  { requests: MeetingRequest[] } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('company_id', member.companyId)
    .or(`requester_id.eq.${member.id},requestee_id.eq.${member.id}`)
    .order('created_at', { ascending: false })
  return {
    requests: ((data ?? []) as RawMeetingRow[]).map(rowToRequest)
  }
}

export async function listPendingApprovals(): Promise<
  { requests: MeetingRequest[] } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
    return { error: 'Admins and leads only.' }
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('company_id', member.companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return {
    requests: ((data ?? []) as RawMeetingRow[]).map(rowToRequest)
  }
}

// ─── Approve / Reject (admin or lead) ────────────────────────────────────

export async function approveMeetingRequest(
  meetingId: string
): Promise<{ request: MeetingRequest } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
    return { error: 'Admins and leads only.' }
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'approved',
      approved_by_id: member.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('status', 'pending')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Request already handled or missing.' }
  }
  const request = rowToRequest(data as RawMeetingRow)
  await sendApprovedEmailToRequestee(request)
  revalidatePath('/dashboard')
  return { request }
}

export async function rejectMeetingRequest(
  meetingId: string,
  reason?: string
): Promise<{ request: MeetingRequest } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
    return { error: 'Admins and leads only.' }
  }
  const trimmed = (reason ?? '').trim().slice(0, 500) || null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'rejected',
      approved_by_id: member.id,
      approved_at: new Date().toISOString(),
      rejection_reason: trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('status', 'pending')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Request already handled or missing.' }
  }
  const request = rowToRequest(data as RawMeetingRow)
  await sendDeclinedOrRejectedEmail(request, 'Rejected', member.fullName, trimmed)
  revalidatePath('/dashboard')
  return { request }
}

// ─── Requestee pick time / pick slot / decline ───────────────────────────

// pick_day mode: requestee provides an ISO datetime they want.
export async function pickMeetingTime(
  meetingId: string,
  startsAt: string
): Promise<{ request: MeetingRequest } | { error: string }> {
  const parsed = ISO_DATETIME.safeParse(startsAt)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid datetime.' }
  }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('meeting_requests')
    .select('mode, proposed_date, requestee_id, status')
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!row) return { error: 'Meeting not found.' }
  if (row.requestee_id !== member.id) {
    return { error: 'Only the requestee can pick a time.' }
  }
  if (row.status !== 'approved') {
    return { error: 'This meeting is not waiting for a time pick.' }
  }
  if (row.mode !== 'day') {
    return { error: 'This meeting uses fixed slots. Pick one of them instead.' }
  }
  if (new Date(parsed.data).getTime() < Date.now()) {
    return { error: 'Pick a time in the future.' }
  }

  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'scheduled',
      selected_starts_at: parsed.data,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('status', 'approved')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not save time pick.' }
  }
  const finalized = await finalizeSchedule(
    member.companyId,
    rowToRequest(data as RawMeetingRow)
  )
  revalidatePath('/dashboard')
  return { request: finalized }
}

// pick_slot mode: requestee picks one of the proposed slot indices.
export async function pickMeetingSlot(
  meetingId: string,
  slotIndex: number
): Promise<{ request: MeetingRequest } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('meeting_requests')
    .select('mode, slots, requestee_id, status')
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!row) return { error: 'Meeting not found.' }
  if (row.requestee_id !== member.id) {
    return { error: 'Only the requestee can pick a slot.' }
  }
  if (row.status !== 'approved') {
    return { error: 'This meeting is not waiting for a slot pick.' }
  }
  if (row.mode !== 'slots') {
    return { error: 'This meeting uses an open day. Pick a time instead.' }
  }
  const slots = Array.isArray(row.slots) ? (row.slots as string[]) : []
  if (slotIndex < 0 || slotIndex >= slots.length) {
    return { error: 'Invalid slot index.' }
  }
  const pickedStartsAt = slots[slotIndex]

  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'scheduled',
      selected_slot_index: slotIndex,
      selected_starts_at: pickedStartsAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('status', 'approved')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not save slot pick.' }
  }
  const finalized = await finalizeSchedule(
    member.companyId,
    rowToRequest(data as RawMeetingRow)
  )
  revalidatePath('/dashboard')
  return { request: finalized }
}

export async function declineMeetingRequest(
  meetingId: string,
  reason?: string
): Promise<{ request: MeetingRequest } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const trimmed = (reason ?? '').trim().slice(0, 500) || null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'declined',
      decline_reason: trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('requestee_id', member.id)
    .eq('status', 'approved')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not decline.' }
  }
  const request = rowToRequest(data as RawMeetingRow)
  await sendDeclinedOrRejectedEmail(request, 'Declined', member.fullName, trimmed)
  revalidatePath('/dashboard')
  return { request }
}

// ─── Requester cancel ────────────────────────────────────────────────────

export async function cancelMeetingRequest(
  meetingId: string
): Promise<{ request: MeetingRequest } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('requester_id', member.id)
    .in('status', ['pending', 'approved', 'scheduled'])
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not cancel.' }
  }
  revalidatePath('/dashboard')
  return { request: rowToRequest(data as RawMeetingRow) }
}

// ─── Calendar event + scheduled email ────────────────────────────────────

// Called right after a meeting flips to 'scheduled'. Best-effort:
//   - if the workspace has Google connected, create a Calendar event
//     with a Meet link and persist event_id + meet_link.
//   - then email both parties the booking with the Meet link.
// If Google isn't connected, we skip the calendar step; both parties
// still get an email confirming the time without a join link.
async function finalizeSchedule(
  companyId: string,
  request: MeetingRequest
): Promise<MeetingRequest> {
  if (!request.selectedStartsAt) return request
  const supabase = createAdminClient()

  const { data: parties } = await supabase
    .from('team_members')
    .select('id, full_name, contact_email, email, timezone')
    .in('id', [request.requesterId, request.requesteeId])
  const requester = parties?.find((p) => p.id === request.requesterId)
  const requestee = parties?.find((p) => p.id === request.requesteeId)
  const requesterEmail =
    requester && ((requester.contact_email && requester.contact_email.trim()) || requester.email)
  const requesteeEmail =
    requestee && ((requestee.contact_email && requestee.contact_email.trim()) || requestee.email)

  let eventId: string | null = null
  let meetLink: string | null = null
  let calendarHtmlLink: string | null = null

  if (requesterEmail && requesteeEmail) {
    const result = await createCalendarEventWithMeet({
      companyId,
      startsAt: new Date(request.selectedStartsAt),
      durationMin: request.durationMin,
      title: request.title,
      description: request.agenda,
      attendeeEmails: [requesterEmail, requesteeEmail]
    }).catch((err) => ({ error: String(err).slice(0, 200) }))

    if (!('error' in result)) {
      eventId = result.eventId
      meetLink = result.meetLink
      calendarHtmlLink = result.htmlLink
      await supabase
        .from('meeting_requests')
        .update({
          calendar_event_id: eventId,
          meet_link: meetLink,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)
    } else {
      console.warn('[meetings] calendar event skipped:', result.error)
    }
  }

  // Fetch pref rows for both parties in a single round-trip.
  const { data: prefs } = await supabase
    .from('notification_email_prefs')
    .select('member_id, meetings')
    .in('member_id', [request.requesterId, request.requesteeId])
  const prefMap = new Map((prefs ?? []).map((p) => [p.member_id, p.meetings]))

  await Promise.all(
    [
      { side: 'requester' as const, party: requester, email: requesterEmail, counter: request.requesteeName },
      { side: 'requestee' as const, party: requestee, email: requesteeEmail, counter: request.requesterName }
    ].map(async (p) => {
      if (!p.party || !p.email) return
      if (prefMap.get(p.party.id) === false) return
      const unsubscribeUrl = await buildUnsubscribeUrl(p.party.id)
      const { subject, html, text } = meetingScheduledEmail({
        recipientName: p.party.full_name,
        counterpartyName: p.counter,
        title: request.title,
        agenda: request.agenda,
        durationMin: request.durationMin,
        startsAt: request.selectedStartsAt!,
        meetLink,
        calendarEventLink: calendarHtmlLink,
        recipientTimezone: p.party.timezone,
        unsubscribeUrl
      })
      await sendEmail({
        to: p.email,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_scheduled'
      }).catch(() => undefined)
    })
  )

  return {
    ...request,
    calendarEventId: eventId,
    meetLink
  }
}

// ─── Email fan-outs (best-effort, never block) ───────────────────────────

async function fanOutApprovalEmails(
  companyId: string,
  request: MeetingRequest
): Promise<void> {
  const supabase = createAdminClient()
  const { data: approvers } = await supabase
    .from('team_members')
    .select('id, full_name, contact_email, email, timezone')
    .eq('company_id', companyId)
    .in('access_tier', ['admin', 'lead'])
  if (!approvers || approvers.length === 0) return

  const approvalUrl = absoluteUrl(`/dashboard?meetings=${request.id}`)
  const ids = approvers.map((a) => a.id)
  const { data: prefs } = await supabase
    .from('notification_email_prefs')
    .select('member_id, meetings')
    .in('member_id', ids)
  const prefMap = new Map((prefs ?? []).map((p) => [p.member_id, p.meetings]))

  await Promise.all(
    approvers.map(async (a) => {
      if (prefMap.get(a.id) === false) return
      const to = (a.contact_email && a.contact_email.trim()) || a.email
      if (!to) return
      const unsubscribeUrl = await buildUnsubscribeUrl(a.id)
      const { subject, html, text } = meetingRequestSubmittedEmail({
        recipientName: a.full_name,
        requesterName: request.requesterName,
        requesteeName: request.requesteeName,
        title: request.title,
        agenda: request.agenda,
        durationMin: request.durationMin,
        mode: request.mode,
        proposedDate: request.proposedDate,
        slotIsos: request.slots,
        approvalUrl,
        recipientTimezone: a.timezone,
        unsubscribeUrl
      })
      await sendEmail({
        to,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_request'
      }).catch(() => undefined)
    })
  )
}

async function sendApprovedEmailToRequestee(
  request: MeetingRequest
): Promise<void> {
  const supabase = createAdminClient()
  const [{ data: requestee }, { data: pref }] = await Promise.all([
    supabase
      .from('team_members')
      .select('full_name, contact_email, email, timezone')
      .eq('id', request.requesteeId)
      .maybeSingle(),
    supabase
      .from('notification_email_prefs')
      .select('meetings')
      .eq('member_id', request.requesteeId)
      .maybeSingle()
  ])
  if (!requestee) return
  if (pref?.meetings === false) return
  const to = (requestee.contact_email && requestee.contact_email.trim()) || requestee.email
  if (!to) return
  const unsubscribeUrl = await buildUnsubscribeUrl(request.requesteeId)
  const pickUrl = absoluteUrl(`/dashboard?meetings=${request.id}`)
  const { subject, html, text } = meetingApprovedEmail({
    recipientName: requestee.full_name,
    requesterName: request.requesterName,
    title: request.title,
    agenda: request.agenda,
    durationMin: request.durationMin,
    mode: request.mode,
    proposedDate: request.proposedDate,
    slotIsos: request.slots,
    pickUrl,
    recipientTimezone: requestee.timezone,
    unsubscribeUrl
  })
  await sendEmail({
    to,
    subject,
    html,
    text,
    unsubscribeUrl,
    tag: 'meeting_approved'
  }).catch(() => undefined)
}

async function sendDeclinedOrRejectedEmail(
  request: MeetingRequest,
  label: 'Declined' | 'Rejected',
  declinerName: string,
  reason: string | null
): Promise<void> {
  const supabase = createAdminClient()
  const [{ data: requester }, { data: pref }] = await Promise.all([
    supabase
      .from('team_members')
      .select('full_name, contact_email, email')
      .eq('id', request.requesterId)
      .maybeSingle(),
    supabase
      .from('notification_email_prefs')
      .select('meetings')
      .eq('member_id', request.requesterId)
      .maybeSingle()
  ])
  if (!requester) return
  if (pref?.meetings === false) return
  const to = (requester.contact_email && requester.contact_email.trim()) || requester.email
  if (!to) return
  const unsubscribeUrl = await buildUnsubscribeUrl(request.requesterId)
  const { subject, html, text } = meetingDeclinedOrRejectedEmail({
    recipientName: requester.full_name,
    declinerName,
    title: request.title,
    reason,
    reasonLabel: label,
    unsubscribeUrl
  })
  await sendEmail({
    to,
    subject,
    html,
    text,
    unsubscribeUrl,
    tag: label === 'Declined' ? 'meeting_declined' : 'meeting_rejected'
  }).catch(() => undefined)
}
