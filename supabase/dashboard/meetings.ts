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
  meetingRescheduledEmail,
  meetingScheduledEmail
} from '@/lib/email/templates'
import {
  createCalendarEventWithMeet,
  deleteCalendarEvent
} from '@/lib/google/calendar'
import { logActivity } from './mutations'
import type { Database, Json, TablesInsert } from '@/supabase/types'

// Meeting-request server actions. Service-role only (the dashboard talks
// via createAdminClient per ADR 0032). Authorization is enforced in
// code, not at the row level.
//
// Two scheduling modes (1:1 only) plus group:
//   - 'day':   1 attendee. Requester proposes a date; attendee picks
//              the time on it.
//   - 'slots': 1 attendee with 2-3 proposed datetimes (attendee picks)
//              OR 2+ attendees with exactly 1 datetime (requester locks
//              the time at creation; no pick step).
//
// State machine:
//   1:1:   pending -> approved -> scheduled | declined | canceled
//          pending -> rejected | canceled
//   group: pending -> scheduled | rejected | canceled
//          (admin approve goes straight to scheduled; no pick step)

type MeetingStatus = Database['public']['Enums']['meeting_request_status']

const DATE_ONLY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use YYYY-MM-DD for the date.' })

const ISO_DATETIME = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Use an ISO datetime.'
})

const BaseCreate = z.object({
  attendeeIds: z.array(z.string().uuid()).min(1),
  title: z.string().trim().min(1).max(140),
  agenda: z.string().trim().max(2000).optional().nullable(),
  durationMin: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90)
  ]),
  goal: z.string().trim().max(2000).optional().nullable(),
  context: z.string().trim().max(4000).optional().nullable(),
  questions: z.string().trim().max(4000).optional().nullable(),
  preRead: z.string().trim().max(2000).optional().nullable(),
  linkedTaskId: z.string().uuid().optional().nullable()
})

const CreateMeetingInput = z
  .discriminatedUnion('mode', [
    BaseCreate.extend({
      mode: z.literal('day'),
      proposedDate: DATE_ONLY
    }),
    BaseCreate.extend({
      mode: z.literal('slots'),
      slots: z.array(ISO_DATETIME).min(1).max(3)
    })
  ])
  .superRefine((value, ctx) => {
    // Group meetings (2+ attendees) must lock a specific time at
    // creation: mode='slots' with exactly one slot. The pick-step
    // doesn't make sense when many people are invited.
    if (value.attendeeIds.length >= 2) {
      if (value.mode !== 'slots' || value.slots.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Group meetings need a single locked time. Switch to specific-time mode and pick one slot.'
        })
      }
    }
    // 1:1 slot mode must propose 2 or 3 options - one option would be
    // equivalent to a group meeting (and is allowed when length===1
    // attendee only via a separate "lock it" UI in the future).
    if (
      value.attendeeIds.length === 1 &&
      value.mode === 'slots' &&
      (value.slots.length < 2 || value.slots.length > 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '1:1 propose-slots mode needs 2 or 3 slots.'
      })
    }
  })

export type CreateMeetingInputT = z.infer<typeof CreateMeetingInput>

export interface MeetingAttendee {
  id: string
  fullName: string
  avatarUrl: string | null
  pickedAt: string | null
}

export type MeetingOutcome = Database['public']['Enums']['meeting_outcome']

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
  requesterAvatarUrl: string | null
  attendees: MeetingAttendee[]
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
  // Post-meeting review fields. Populated once either participant fills
  // the review form after the scheduled end-time has passed.
  outcome: MeetingOutcome | null
  reviewNotes: string | null
  reviewedAt: string | null
  reviewedById: string | null
  followUpMeetingId: string | null
  createdAt: string
  updatedAt: string
}

type RawMeetingRow = Database['public']['Tables']['meeting_requests']['Row'] & {
  requester: { full_name: string; avatar_url: string | null } | null
  meeting_attendees?:
    | {
        member_id: string
        picked_at: string | null
        member: {
          full_name: string
          avatar_url: string | null
        } | null
      }[]
    | null
  meeting_tasks?: { task_id: string }[] | null
}

function rowToRequest(r: RawMeetingRow): MeetingRequest {
  const mode = (r.mode === 'slots' ? 'slots' : 'day') as 'day' | 'slots'
  const attendees: MeetingAttendee[] = (r.meeting_attendees ?? []).map((a) => ({
    id: a.member_id,
    fullName: a.member?.full_name ?? 'Someone',
    avatarUrl: a.member?.avatar_url ?? null,
    pickedAt: a.picked_at
  }))
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
    requesterAvatarUrl: r.requester?.avatar_url ?? null,
    attendees,
    approvedById: r.approved_by_id,
    approvedAt: r.approved_at,
    rejectionReason: r.rejection_reason,
    declineReason: r.decline_reason,
    goal: r.goal,
    context: r.context,
    questions: r.questions,
    preRead: r.pre_read,
    requesteeContext: r.requestee_context,
    linkedTaskIds: (r.meeting_tasks ?? []).map((mt) => mt.task_id),
    outcome: r.outcome,
    reviewNotes: r.review_notes,
    reviewedAt: r.reviewed_at,
    reviewedById: r.reviewed_by_id,
    followUpMeetingId: r.follow_up_meeting_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

const SELECT_WITH_NAMES = `*, requester:team_members!meeting_requests_requester_id_fkey(full_name, avatar_url), meeting_attendees(member_id, picked_at, member:team_members(full_name, avatar_url)), meeting_tasks(task_id)`

// Helper used by per-row gating: callers must be participant (requester
// or one of the attendees) or workspace admin/lead.
async function fetchMeetingForGate(
  supabase: ReturnType<typeof createAdminClient>,
  meetingId: string,
  companyId: string
) {
  const { data } = await supabase
    .from('meeting_requests')
    .select(
      'company_id, requester_id, status, mode, slots, proposed_date, selected_starts_at, duration_min, calendar_event_id, meeting_attendees(member_id)'
    )
    .eq('id', meetingId)
    .eq('company_id', companyId)
    .maybeSingle()
  return data
}

// ─── Create ──────────────────────────────────────────────────────────────

export async function createMeetingRequest(
  raw: z.input<typeof CreateMeetingInput>
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const parsed = CreateMeetingInput.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const input = parsed.data
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const uniqueAttendees = Array.from(new Set(input.attendeeIds))
  if (uniqueAttendees.includes(member.id)) {
    return { error: "You can't add yourself as an attendee." }
  }

  const supabase = createAdminClient()
  const { data: roster } = await supabase
    .from('team_members')
    .select('id, company_id')
    .in('id', uniqueAttendees)
  const inWorkspace = (roster ?? []).every(
    (m) => m.company_id === member.companyId
  )
  if (!roster || roster.length !== uniqueAttendees.length || !inWorkspace) {
    return { error: 'One or more attendees not found in your workspace.' }
  }

  const isGroup = uniqueAttendees.length >= 2
  // For groups the requester locks one specific time; that becomes the
  // selected_starts_at right away. For 1:1 selected_starts_at stays
  // null until the attendee picks.
  const lockedStartsAt =
    isGroup && input.mode === 'slots' ? input.slots[0] : null

  const insert: TablesInsert<'meeting_requests'> = {
    company_id: member.companyId,
    requester_id: member.id,
    title: input.title,
    agenda: input.agenda?.trim() || null,
    duration_min: input.durationMin,
    status: 'pending',
    mode: input.mode,
    proposed_date: input.mode === 'day' ? input.proposedDate : null,
    slots:
      input.mode === 'slots' ? (input.slots as unknown as Json) : null,
    selected_slot_index: null,
    selected_starts_at: lockedStartsAt,
    goal: input.goal?.trim() || null,
    context: input.context?.trim() || null,
    questions: input.questions?.trim() || null,
    pre_read: input.preRead?.trim() || null
  }

  const { data, error } = await supabase
    .from('meeting_requests')
    .insert(insert)
    .select('id')
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not create meeting request.' }
  }

  // Insert attendees in one go.
  const attendeeRows = uniqueAttendees.map((id) => ({
    meeting_id: data.id,
    member_id: id
  }))
  const attRes = await supabase.from('meeting_attendees').insert(attendeeRows)
  if (attRes.error) {
    // Roll back the meeting if the attendees fail (rare but keeps the
    // table from holding zombie rows without participants).
    await supabase.from('meeting_requests').delete().eq('id', data.id)
    return { error: attRes.error.message }
  }

  if (input.linkedTaskId) {
    await supabase.from('meeting_tasks').insert({
      meeting_id: data.id,
      task_id: input.linkedTaskId,
      linked_by_id: member.id
    })
  }

  const { data: full } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('id', data.id)
    .single()
  const request = rowToRequest(full as RawMeetingRow)

  const emailStatus = await fanOutApprovalEmails(member.companyId, request)
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.requested',
    'meeting',
    data.id,
    { title: input.title }
  )
  revalidatePath('/dashboard')
  return { request, emailStatus }
}

// ─── List ────────────────────────────────────────────────────────────────

export async function listMyMeetingRequests(): Promise<
  { requests: MeetingRequest[] } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  // PostgREST can't easily express "where I'm the requester OR one of
  // the attendees" in a single .or() across a join, so we run two
  // small queries and merge.
  const [{ data: requested }, { data: attending }] = await Promise.all([
    supabase
      .from('meeting_requests')
      .select(SELECT_WITH_NAMES)
      .eq('company_id', member.companyId)
      .eq('requester_id', member.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('meeting_requests')
      .select(SELECT_WITH_NAMES + ',ma_self:meeting_attendees!inner(member_id)')
      .eq('company_id', member.companyId)
      .eq('ma_self.member_id', member.id)
      .order('created_at', { ascending: false })
  ])
  const byId = new Map<string, RawMeetingRow>()
  for (const r of (requested ?? []) as unknown as RawMeetingRow[]) byId.set(r.id, r)
  for (const r of (attending ?? []) as unknown as RawMeetingRow[]) byId.set(r.id, r)
  const merged = Array.from(byId.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )
  return { requests: merged.map(rowToRequest) }
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
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin' && member.accessTier !== 'lead') {
    return { error: 'Admins and leads only.' }
  }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Request not found.' }
  if (gate.status !== 'pending') {
    return { error: 'Request already handled.' }
  }
  // Group meetings skip the attendee-pick step: admin approval goes
  // straight to 'scheduled', and finalizeSchedule creates the Calendar
  // event immediately. 1:1 meetings transition to 'approved' and wait
  // for the attendee to pick.
  const isGroup = (gate.meeting_attendees ?? []).length >= 2
  const nextStatus: MeetingStatus = isGroup ? 'scheduled' : 'approved'
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: nextStatus,
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
  let request = rowToRequest(data as RawMeetingRow)
  let emailStatus: EmailFanoutResult
  if (isGroup) {
    const finalized = await finalizeSchedule(member.companyId, request)
    request = finalized.request
    emailStatus = finalized.emailStatus
  } else {
    emailStatus = await sendApprovedEmailToAttendees(request)
  }
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    isGroup ? 'meeting.scheduled' : 'meeting.approved',
    'meeting',
    meetingId,
    { title: request.title }
  )
  revalidatePath('/dashboard')
  return { request, emailStatus }
}

export async function rejectMeetingRequest(
  meetingId: string,
  reason?: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
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
  const emailStatus = await sendDeclinedOrRejectedEmail(
    request,
    'Rejected',
    member.fullName,
    trimmed
  )
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.rejected',
    'meeting',
    meetingId,
    { title: request.title, reason: trimmed }
  )
  revalidatePath('/dashboard')
  return { request, emailStatus }
}

// ─── Attendee pick time / pick slot / decline (1:1 only) ─────────────────

function isAttendee(
  gate: { meeting_attendees?: { member_id: string }[] | null },
  memberId: string
): boolean {
  return (gate.meeting_attendees ?? []).some((a) => a.member_id === memberId)
}

export async function pickMeetingTime(
  meetingId: string,
  startsAt: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const parsed = ISO_DATETIME.safeParse(startsAt)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid datetime.' }
  }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  if (!isAttendee(gate, member.id)) {
    return { error: 'Only an attendee can pick a time.' }
  }
  if ((gate.meeting_attendees ?? []).length >= 2) {
    return { error: 'Group meetings have a locked time set by the requester.' }
  }
  if (gate.status !== 'approved') {
    return { error: 'This meeting is not waiting for a time pick.' }
  }
  if (gate.mode !== 'day') {
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
  await supabase
    .from('meeting_attendees')
    .update({ picked_at: parsed.data })
    .eq('meeting_id', meetingId)
    .eq('member_id', member.id)
  const { request: finalized, emailStatus } = await finalizeSchedule(
    member.companyId,
    rowToRequest(data as RawMeetingRow)
  )
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.scheduled',
    'meeting',
    meetingId,
    { title: finalized.title, startsAt: parsed.data }
  )
  revalidatePath('/dashboard')
  return { request: finalized, emailStatus }
}

export async function pickMeetingSlot(
  meetingId: string,
  slotIndex: number
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  if (!isAttendee(gate, member.id)) {
    return { error: 'Only an attendee can pick a slot.' }
  }
  if ((gate.meeting_attendees ?? []).length >= 2) {
    return { error: 'Group meetings have a locked time set by the requester.' }
  }
  if (gate.status !== 'approved') {
    return { error: 'This meeting is not waiting for a slot pick.' }
  }
  if (gate.mode !== 'slots') {
    return { error: 'This meeting uses an open day. Pick a time instead.' }
  }
  const slots = Array.isArray(gate.slots) ? (gate.slots as string[]) : []
  if (slotIndex < 0 || slotIndex >= slots.length) {
    return { error: 'Invalid slot index.' }
  }
  const pickedStartsAt = slots[slotIndex]
  // Mirrors the future-time guard on pickMeetingTime. Slot-mode was
  // missing it - a stale proposal could still be booked into the past
  // and create a Calendar event for a meeting that's already over.
  if (new Date(pickedStartsAt).getTime() < Date.now()) {
    return { error: 'That slot has already passed. Ask the requester to reschedule.' }
  }

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
  await supabase
    .from('meeting_attendees')
    .update({ picked_at: pickedStartsAt })
    .eq('meeting_id', meetingId)
    .eq('member_id', member.id)
  const { request: finalized, emailStatus } = await finalizeSchedule(
    member.companyId,
    rowToRequest(data as RawMeetingRow)
  )
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.scheduled',
    'meeting',
    meetingId,
    { title: finalized.title, startsAt: pickedStartsAt }
  )
  revalidatePath('/dashboard')
  return { request: finalized, emailStatus }
}

export async function declineMeetingRequest(
  meetingId: string,
  reason?: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const trimmed = (reason ?? '').trim().slice(0, 500) || null
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  if (!isAttendee(gate, member.id)) {
    return { error: 'Only an attendee can decline.' }
  }
  if ((gate.meeting_attendees ?? []).length >= 2) {
    return {
      error:
        "Group meetings can't be declined individually. Ask the requester to cancel."
    }
  }
  if (gate.status !== 'approved') {
    return { error: 'This meeting is not in a declinable state.' }
  }
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      status: 'declined',
      decline_reason: trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('status', 'approved')
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not decline.' }
  }
  const request = rowToRequest(data as RawMeetingRow)
  const emailStatus = await sendDeclinedOrRejectedEmail(
    request,
    'Declined',
    member.fullName,
    trimmed
  )
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.declined',
    'meeting',
    meetingId,
    { title: request.title, reason: trimmed }
  )
  revalidatePath('/dashboard')
  return { request, emailStatus }
}

// ─── Reschedule (either party) ───────────────────────────────────────────

const RescheduleInput = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('day'),
      proposedDate: DATE_ONLY,
      reason: z.string().trim().max(500).optional().nullable()
    }),
    z.object({
      mode: z.literal('slots'),
      slots: z.array(ISO_DATETIME).min(1).max(3),
      reason: z.string().trim().max(500).optional().nullable()
    })
  ])

export async function rescheduleMeetingRequest(
  meetingId: string,
  raw: z.input<typeof RescheduleInput>
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const parsed = RescheduleInput.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const input = parsed.data
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  const isPlanner =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  const isParticipant =
    gate.requester_id === member.id || isAttendee(gate, member.id)
  if (!isParticipant && !isPlanner) {
    return { error: 'Only participants can reschedule this meeting.' }
  }
  if (
    !['pending', 'approved', 'scheduled'].includes(gate.status as string)
  ) {
    return { error: 'This meeting cannot be rescheduled in its current state.' }
  }

  const attendeeCount = (gate.meeting_attendees ?? []).length
  const isGroup = attendeeCount >= 2

  // Group meetings: must be slots with exactly 1 slot. 1:1 day mode:
  // proposedDate. 1:1 slots mode: 2 or 3 slots.
  if (isGroup) {
    if (input.mode !== 'slots' || input.slots.length !== 1) {
      return {
        error:
          'Group meetings must reschedule with exactly one specific time.'
      }
    }
  } else {
    if (input.mode === 'slots' && (input.slots.length < 2 || input.slots.length > 3)) {
      return { error: '1:1 slot reschedule needs 2 or 3 slots.' }
    }
  }

  // For groups the new locked time becomes selected_starts_at and the
  // status stays 'scheduled'. For 1:1 the meeting goes back to
  // 'approved' so the attendee can pick again (and selected_starts_at
  // clears).
  const nextStatus: MeetingStatus = isGroup ? 'scheduled' : 'approved'
  const newProposedDate = input.mode === 'day' ? input.proposedDate : null
  const newSlots =
    input.mode === 'slots' ? (input.slots as unknown as Json) : null
  const newSelectedStartsAt =
    isGroup && input.mode === 'slots' ? input.slots[0] : null
  const reason = input.reason?.trim() || null

  // Stash the previous Calendar event id so we can delete it after the
  // row update succeeds. We'll re-create it via finalizeSchedule when
  // it's a group meeting.
  const previousEventId = (await supabase
    .from('meeting_requests')
    .select('calendar_event_id')
    .eq('id', meetingId)
    .single()).data?.calendar_event_id ?? null

  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      mode: input.mode,
      proposed_date: newProposedDate,
      slots: newSlots,
      selected_starts_at: newSelectedStartsAt,
      selected_slot_index: null,
      calendar_event_id: null,
      meet_link: null,
      status: nextStatus,
      last_rescheduled_at: new Date().toISOString(),
      last_rescheduled_by_id: member.id,
      reschedule_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .in('status', ['pending', 'approved', 'scheduled'])
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not reschedule.' }
  }

  // Reset every attendee's picked_at so they can pick again (1:1) or
  // so the bookkeeping stays consistent (groups: no picks anyway).
  await supabase
    .from('meeting_attendees')
    .update({ picked_at: null })
    .eq('meeting_id', meetingId)

  // Best-effort: delete the old Calendar event so a stale Meet link
  // doesn't linger on the scheduler's calendar. sendUpdates=all also
  // sends Google's own cancellation email to the attendees, which is
  // a useful side-channel alongside our own reschedule email.
  if (previousEventId) {
    const del = await deleteCalendarEvent(
      member.companyId,
      previousEventId
    ).catch((err) => ({ error: String(err).slice(0, 200) }))
    if ('error' in del) {
      console.warn('[meetings] failed to delete old Calendar event:', del.error)
    }
  }

  let request = rowToRequest(data as RawMeetingRow)
  const emailStatus = emptyFanout()
  if (isGroup) {
    // Recreate Calendar event + send "scheduled" emails. finalizeSchedule
    // uses the new selected_starts_at.
    const finalized = await finalizeSchedule(member.companyId, request)
    request = finalized.request
    emailStatus.sent += finalized.emailStatus.sent
    emailStatus.failures.push(...finalized.emailStatus.failures)
  }
  const rescheduledStatus = await sendRescheduledEmail(
    request,
    member.id,
    member.fullName,
    member.avatarUrl ?? null,
    reason,
    !isGroup
  )
  emailStatus.sent += rescheduledStatus.sent
  emailStatus.failures.push(...rescheduledStatus.failures)
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.rescheduled',
    'meeting',
    meetingId,
    { title: request.title, reason }
  )
  revalidatePath('/dashboard')
  return { request, emailStatus }
}

// ─── Requester cancel ────────────────────────────────────────────────────

export async function cancelMeetingRequest(
  meetingId: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  // Grab the calendar_event_id BEFORE the update so we know whether
  // there's a Google event to clean up. Once status flips to canceled
  // we still keep the id on the row for audit purposes; the delete
  // call happens in parallel.
  const previousEventId = (await supabase
    .from('meeting_requests')
    .select('calendar_event_id')
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .eq('requester_id', member.id)
    .maybeSingle()).data?.calendar_event_id ?? null

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

  if (previousEventId) {
    const del = await deleteCalendarEvent(
      member.companyId,
      previousEventId
    ).catch((err) => ({ error: String(err).slice(0, 200) }))
    if ('error' in del) {
      console.warn('[meetings] failed to delete Calendar event on cancel:', del.error)
    }
  }

  const request = rowToRequest(data as RawMeetingRow)
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.canceled',
    'meeting',
    meetingId,
    { title: request.title }
  )
  revalidatePath('/dashboard')
  return { request }
}

// ─── Post-meeting review (either participant) ────────────────────────────

const ReviewInput = z.object({
  outcome: z.enum(['resolved', 'partial', 'needs_followup', 'failed']),
  notes: z.string().trim().max(4000).optional().nullable()
})

export async function submitMeetingReview(
  meetingId: string,
  raw: z.input<typeof ReviewInput>
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const parsed = ReviewInput.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  const isParticipant =
    gate.requester_id === member.id || isAttendee(gate, member.id)
  if (!isParticipant) {
    return { error: 'Only participants can leave a review.' }
  }
  if (gate.status !== 'scheduled' && gate.status !== 'completed') {
    return { error: 'Only scheduled or completed meetings can be reviewed.' }
  }
  if (!gate.selected_starts_at) {
    return { error: 'This meeting has no scheduled time.' }
  }
  const endsAtMs =
    new Date(gate.selected_starts_at).getTime() + gate.duration_min * 60_000
  if (endsAtMs > Date.now()) {
    return { error: 'You can review this meeting once it ends.' }
  }

  const trimmedNotes = parsed.data.notes?.trim() || null
  // Reviewing a meeting also flips its status to 'completed' so it
  // disappears from active lists. The original scheduled timestamp
  // stays for history.
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      outcome: parsed.data.outcome,
      review_notes: trimmedNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by_id: member.id,
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .in('status', ['scheduled', 'completed'])
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not save review.' }
  }
  const request = rowToRequest(data as RawMeetingRow)
  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'meeting.reviewed',
    'meeting',
    meetingId,
    { title: request.title, outcome: parsed.data.outcome }
  )
  revalidatePath('/dashboard')
  return { request }
}

// ─── Manual resend of the situational email ──────────────────────────────
//
// Surfaces a "Resend email" affordance on inbox cards so the requester
// (or any participant) can re-fire the notification when Resend
// silently swallowed the original send, or when the recipient lost it
// to spam. The function dispatches the email that matches the meeting's
// current status:
//   pending    -> meeting_request   (re-notify approvers)
//   approved   -> meeting_approved  (re-notify the attendee to pick)
//   scheduled  -> meeting_scheduled (re-notify everyone of the time)
// Other statuses don't have a meaningful resend.

export async function resendMeetingNotification(
  meetingId: string
): Promise<{ emailStatus: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .maybeSingle()
  if (!data) return { error: 'Meeting not found.' }

  const row = data as RawMeetingRow
  const isPlanner =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  const isRequester = row.requester_id === member.id
  const isAttendeeRow = (row.meeting_attendees ?? []).some(
    (a) => a.member_id === member.id
  )
  if (!isRequester && !isAttendeeRow && !isPlanner) {
    return { error: 'Only participants can resend.' }
  }

  const request = rowToRequest(row)
  let emailStatus: EmailFanoutResult
  if (request.status === 'pending') {
    emailStatus = await fanOutApprovalEmails(member.companyId, request)
  } else if (request.status === 'approved') {
    emailStatus = await sendApprovedEmailToAttendees(request)
  } else if (request.status === 'scheduled') {
    // Re-send "scheduled" to everyone. We don't recreate the Calendar
    // event here - just the email, which matches what users mean when
    // they click "Resend".
    const { emailStatus: result } = await finalizeSchedule(
      member.companyId,
      request
    )
    emailStatus = result
  } else {
    return {
      error: `No email to resend for "${request.status}" meetings.`
    }
  }
  return { emailStatus }
}

// ─── Attendee appends context (after approve, 1:1 only) ──────────────────

export async function appendMeetingContext(
  meetingId: string,
  text: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const trimmed = text.trim().slice(0, 4000)
  if (!trimmed) return { error: 'Context cannot be empty.' }
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  if (!isAttendee(gate, member.id)) {
    return { error: 'Only an attendee can add context.' }
  }
  if (!['approved', 'scheduled'].includes(gate.status)) {
    return { error: 'This meeting is not in a context-editable state.' }
  }
  const { data, error } = await supabase
    .from('meeting_requests')
    .update({
      requestee_context: trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('id', meetingId)
    .eq('company_id', member.companyId)
    .select(SELECT_WITH_NAMES)
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Could not save context.' }
  }
  revalidatePath('/dashboard')
  return { request: rowToRequest(data as RawMeetingRow) }
}

// ─── Task <-> meeting linking ────────────────────────────────────────────

async function gateParticipantOrPlanner(
  supabase: ReturnType<typeof createAdminClient>,
  meetingId: string,
  member: { id: string; companyId: string; accessTier: 'admin' | 'lead' | 'member' }
): Promise<{ ok: true } | { error: string }> {
  const gate = await fetchMeetingForGate(supabase, meetingId, member.companyId)
  if (!gate) return { error: 'Meeting not found.' }
  const isPlanner =
    member.accessTier === 'admin' || member.accessTier === 'lead'
  const isParticipant =
    gate.requester_id === member.id || isAttendee(gate, member.id)
  if (!isParticipant && !isPlanner) {
    return { error: 'You can only manage your own meetings.' }
  }
  return { ok: true }
}

export async function linkTaskToMeeting(
  meetingId: string,
  taskId: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await gateParticipantOrPlanner(supabase, meetingId, member)
  if ('error' in gate) return { error: gate.error }
  const { data: task } = await supabase
    .from('tasks')
    .select('id, company_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || task.company_id !== member.companyId) {
    return { error: 'Task not found.' }
  }
  await supabase
    .from('meeting_tasks')
    .upsert(
      {
        meeting_id: meetingId,
        task_id: taskId,
        linked_by_id: member.id
      },
      { onConflict: 'meeting_id,task_id', ignoreDuplicates: true }
    )
  const { data: row } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('id', meetingId)
    .single()
  revalidatePath('/dashboard')
  return { request: rowToRequest(row as RawMeetingRow) }
}

export async function unlinkTaskFromMeeting(
  meetingId: string,
  taskId: string
): Promise<{ request: MeetingRequest; emailStatus?: EmailFanoutResult } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const gate = await gateParticipantOrPlanner(supabase, meetingId, member)
  if ('error' in gate) return { error: gate.error }
  await supabase
    .from('meeting_tasks')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('task_id', taskId)
  const { data: row } = await supabase
    .from('meeting_requests')
    .select(SELECT_WITH_NAMES)
    .eq('id', meetingId)
    .single()
  revalidatePath('/dashboard')
  return { request: rowToRequest(row as RawMeetingRow) }
}

export async function listMeetingsForTask(
  taskId: string
): Promise<{ requests: MeetingRequest[] } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  // Join through meeting_tasks with an inner filter so only meetings
  // linked to taskId come back.
  const { data } = await supabase
    .from('meeting_requests')
    .select(
      SELECT_WITH_NAMES + ',mt_filter:meeting_tasks!inner(task_id)'
    )
    .eq('company_id', member.companyId)
    .eq('mt_filter.task_id', taskId)
    .order('created_at', { ascending: false })
  return {
    requests: ((data ?? []) as unknown as RawMeetingRow[]).map(rowToRequest)
  }
}

// ─── Per-member review history ───────────────────────────────────────────
//
// Powers the "Recent reviews" section on the PortfolioSheet so users
// can open a teammate's profile and see how their last meetings went.
// Returns completed meetings (status='completed' AND review_notes set)
// where the member was the requester or an attendee, most-recent first.

export interface MemberReviewSummary {
  id: string
  title: string
  reviewedAt: string | null
  selectedStartsAt: string | null
  outcome: MeetingOutcome
  reviewNotes: string | null
  counterpartyName: string
  reviewedByName: string | null
}

export async function listMemberReviews(
  memberId: string,
  limit = 10
): Promise<{ reviews: MemberReviewSummary[] } | { error: string }> {
  const viewer = await getCurrentTeamMember()
  if (!viewer) return { error: 'Not signed in.' }
  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    return { error: 'Invalid member id.' }
  }
  const supabase = createAdminClient()
  // Two cheap targeted queries (member as requester / member as
  // attendee) merged in JS - same pattern as listMyMeetingRequests
  // since PostgREST can't OR across a join in one shot.
  const SELECT = `
    id, title, status, reviewed_at, selected_starts_at, outcome, review_notes,
    requester_id,
    requester:team_members!meeting_requests_requester_id_fkey(full_name),
    reviewed_by:team_members!meeting_requests_reviewed_by_id_fkey(full_name),
    meeting_attendees(member_id, member:team_members(full_name))
  `
  const [{ data: requested }, { data: attending }] = await Promise.all([
    supabase
      .from('meeting_requests')
      .select(SELECT)
      .eq('company_id', viewer.companyId)
      .eq('requester_id', memberId)
      .eq('status', 'completed')
      .not('review_notes', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(limit),
    supabase
      .from('meeting_requests')
      .select(SELECT + ', ma_self:meeting_attendees!inner(member_id)')
      .eq('company_id', viewer.companyId)
      .eq('ma_self.member_id', memberId)
      .eq('status', 'completed')
      .not('review_notes', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(limit)
  ])

  type RawRow = {
    id: string
    title: string
    reviewed_at: string | null
    selected_starts_at: string | null
    outcome: MeetingOutcome
    review_notes: string | null
    requester_id: string
    requester: { full_name: string } | null
    reviewed_by: { full_name: string } | null
    meeting_attendees:
      | { member_id: string; member: { full_name: string } | null }[]
      | null
  }

  const byId = new Map<string, RawRow>()
  for (const r of (requested ?? []) as unknown as RawRow[]) byId.set(r.id, r)
  for (const r of (attending ?? []) as unknown as RawRow[]) byId.set(r.id, r)

  const reviews: MemberReviewSummary[] = Array.from(byId.values())
    .sort((a, b) =>
      (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? '')
    )
    .slice(0, limit)
    .map((r) => {
      // Counterparty is "whoever isn't the focus member." For 1:1
      // that's a single name; for groups we summarize.
      const isFocusRequester = r.requester_id === memberId
      let counterparty: string
      if (isFocusRequester) {
        const others = (r.meeting_attendees ?? []).filter(
          (a) => a.member_id !== memberId
        )
        if (others.length === 0) counterparty = 'someone'
        else if (others.length === 1)
          counterparty = others[0].member?.full_name ?? 'someone'
        else
          counterparty = `${others[0].member?.full_name ?? 'someone'} + ${others.length - 1} more`
      } else {
        counterparty = r.requester?.full_name ?? 'someone'
      }
      return {
        id: r.id,
        title: r.title,
        reviewedAt: r.reviewed_at,
        selectedStartsAt: r.selected_starts_at,
        outcome: r.outcome,
        reviewNotes: r.review_notes,
        counterpartyName: counterparty,
        reviewedByName: r.reviewed_by?.full_name ?? null
      }
    })

  return { reviews }
}

// ─── Public share view ───────────────────────────────────────────────────

export interface SharedMeeting {
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
  proposedDate: string | null
  selectedStartsAt: string | null
  slots: string[] | null
  meetLink: string | null
  requesterName: string
  requesterAvatarUrl: string | null
  attendees: { fullName: string; avatarUrl: string | null }[]
  goal: string | null
  context: string | null
  questions: string | null
  preRead: string | null
  agenda: string | null
  // Post-meeting review surfaces in the recap block on the share page
  // when the meeting is 'completed'. Null on everything else.
  outcome: MeetingOutcome | null
  reviewNotes: string | null
  reviewedAt: string | null
}

const SHARE_VISIBLE_STATUSES = ['pending', 'approved', 'scheduled', 'completed']

export async function fetchMeetingForShare(
  id: string
): Promise<SharedMeeting | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('meeting_requests')
    .select(
      `id, title, status, mode, duration_min, proposed_date, selected_starts_at, slots, meet_link, goal, context, questions, pre_read, agenda, outcome, review_notes, reviewed_at,
       requester:team_members!meeting_requests_requester_id_fkey(full_name, avatar_url),
       meeting_attendees(member:team_members(full_name, avatar_url))`
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  if (!SHARE_VISIBLE_STATUSES.includes(data.status)) return null
  const requester = data.requester as { full_name: string; avatar_url: string | null } | null
  const attendees =
    (
      data.meeting_attendees as
        | { member: { full_name: string; avatar_url: string | null } | null }[]
        | null
    )?.map((a) => ({
      fullName: a.member?.full_name ?? 'Someone',
      avatarUrl: a.member?.avatar_url ?? null
    })) ?? []
  return {
    id: data.id,
    title: data.title,
    status: data.status,
    mode: (data.mode === 'slots' ? 'slots' : 'day') as 'day' | 'slots',
    durationMin: data.duration_min,
    proposedDate: data.proposed_date,
    selectedStartsAt: data.selected_starts_at,
    slots: Array.isArray(data.slots) ? (data.slots as string[]) : null,
    meetLink: data.status === 'scheduled' ? data.meet_link : null,
    requesterName: requester?.full_name ?? 'Someone',
    requesterAvatarUrl: requester?.avatar_url ?? null,
    attendees,
    goal: data.goal,
    context: data.context,
    questions: data.questions,
    preRead: data.pre_read,
    agenda: data.agenda,
    outcome: data.outcome,
    reviewNotes: data.review_notes,
    reviewedAt: data.reviewed_at
  }
}

// ─── Calendar event + scheduled email ────────────────────────────────────

async function finalizeSchedule(
  companyId: string,
  request: MeetingRequest
): Promise<{ request: MeetingRequest; emailStatus: EmailFanoutResult }> {
  const emailStatus = emptyFanout()
  if (!request.selectedStartsAt) return { request, emailStatus }
  const supabase = createAdminClient()

  type Party = {
    id: string
    full_name: string
    contact_email: string | null
    email: string
    timezone: string | null
    avatar_url: string | null
  }
  const memberIds = [
    request.requesterId,
    ...request.attendees.map((a) => a.id)
  ]
  const { data: parties } = await supabase
    .from('team_members')
    .select('id, full_name, contact_email, email, timezone, avatar_url')
    .in('id', memberIds)
  const partyMap = new Map<string, Party>(
    ((parties ?? []) as Party[]).map((p) => [p.id, p])
  )

  const partyEmail = (p: Party | undefined): string | null =>
    p ? (p.contact_email && p.contact_email.trim()) || p.email : null

  const requester = partyMap.get(request.requesterId)
  const requesterEmail = partyEmail(requester)
  const attendeeEmails = request.attendees
    .map((a) => partyEmail(partyMap.get(a.id)))
    .filter((e): e is string => Boolean(e))

  let eventId: string | null = null
  let meetLink: string | null = null
  let calendarHtmlLink: string | null = null

  if (requesterEmail && attendeeEmails.length > 0) {
    const result = await createCalendarEventWithMeet({
      companyId,
      startsAt: new Date(request.selectedStartsAt),
      durationMin: request.durationMin,
      title: request.title,
      description: request.agenda,
      attendeeEmails: [requesterEmail, ...attendeeEmails]
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

  // Fan out the "scheduled" email to requester + every attendee.
  const { data: prefs } = await supabase
    .from('notification_email_prefs')
    .select('member_id, meetings')
    .in('member_id', memberIds)
  const prefMap = new Map((prefs ?? []).map((p) => [p.member_id, p.meetings]))

  await Promise.all(
    memberIds.map(async (memberId) => {
      const party = partyMap.get(memberId)
      if (!party) return
      if (prefMap.get(memberId) === false) return
      const to = partyEmail(party)
      if (!to) return
      const counterparty =
        memberId === request.requesterId
          ? request.attendees.length === 1
            ? request.attendees[0].fullName
            : `${request.attendees[0]?.fullName ?? 'someone'} + ${request.attendees.length - 1} more`
          : request.requesterName
      const counterpartyAvatarUrl =
        memberId === request.requesterId
          ? request.attendees[0]?.avatarUrl ?? null
          : partyMap.get(request.requesterId)?.avatar_url ?? null
      const unsubscribeUrl = await buildUnsubscribeUrl(memberId)
      const { subject, html, text } = meetingScheduledEmail({
        recipientName: party.full_name,
        counterpartyName: counterparty,
        counterpartyAvatarUrl,
        title: request.title,
        agenda: request.agenda,
        durationMin: request.durationMin,
        startsAt: request.selectedStartsAt!,
        meetLink,
        calendarEventLink: calendarHtmlLink,
        recipientTimezone: party.timezone,
        unsubscribeUrl
      })
      const res = await dispatchEmail({
        memberId,
        to,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_scheduled'
      })
      if (res.ok) emailStatus.sent += 1
      else emailStatus.failures.push({ memberId, reason: res.reason })
    })
  )

  return {
    request: {
      ...request,
      calendarEventId: eventId,
      meetLink
    },
    emailStatus
  }
}

// ─── Email fan-outs ───────────────────────────────────────────────────────
//
// Each fanout returns an EmailFanoutResult so the server action can
// surface partial failures to the UI (and we can stop swallowing
// Resend errors silently). `failures` is empty on the happy path.

export interface EmailFanoutResult {
  sent: number
  failures: { memberId: string; reason: string }[]
}

function emptyFanout(): EmailFanoutResult {
  return { sent: 0, failures: [] }
}

// Centralized send + logging so every fanout records the same shape of
// success/failure. The caller never throws on a single bad recipient;
// instead the failure is captured in the returned struct and logged
// for Vercel runtime visibility.
async function dispatchEmail(input: {
  memberId: string
  to: string
  subject: string
  html: string
  text: string
  unsubscribeUrl: string
  tag: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      unsubscribeUrl: input.unsubscribeUrl,
      tag: input.tag
    })
    if (!res.ok) {
      const reason = res.reason ?? 'unknown'
      console.error(
        `[meeting-email] failed (${input.tag}) member=${input.memberId} to=${input.to} reason=${reason}`
      )
      return { ok: false, reason }
    }
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err).slice(0, 200)
    console.error(
      `[meeting-email] threw (${input.tag}) member=${input.memberId} to=${input.to}:`,
      err
    )
    return { ok: false, reason: message }
  }
}

function describeAttendees(request: MeetingRequest): string {
  if (request.attendees.length === 0) return 'someone'
  if (request.attendees.length === 1) return request.attendees[0].fullName
  return `${request.attendees[0].fullName} + ${request.attendees.length - 1} more`
}

async function fanOutApprovalEmails(
  companyId: string,
  request: MeetingRequest
): Promise<EmailFanoutResult> {
  const out = emptyFanout()
  const supabase = createAdminClient()
  const { data: approvers } = await supabase
    .from('team_members')
    .select('id, full_name, contact_email, email, timezone')
    .eq('company_id', companyId)
    .in('access_tier', ['admin', 'lead'])
  if (!approvers || approvers.length === 0) return out

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
        requesterAvatarUrl: request.requesterAvatarUrl,
        requesteeName: describeAttendees(request),
        requesteeAvatarUrl: request.attendees[0]?.avatarUrl ?? null,
        title: request.title,
        agenda: request.agenda,
        durationMin: request.durationMin,
        mode: request.mode,
        proposedDate: request.proposedDate,
        slotIsos: request.slots,
        goal: request.goal,
        context: request.context,
        questions: request.questions,
        approvalUrl,
        recipientTimezone: a.timezone,
        unsubscribeUrl
      })
      const res = await dispatchEmail({
        memberId: a.id,
        to,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_request'
      })
      if (res.ok) out.sent += 1
      else out.failures.push({ memberId: a.id, reason: res.reason })
    })
  )
  return out
}

async function sendApprovedEmailToAttendees(
  request: MeetingRequest
): Promise<EmailFanoutResult> {
  const out = emptyFanout()
  const supabase = createAdminClient()
  const attendeeIds = request.attendees.map((a) => a.id)
  if (attendeeIds.length === 0) return out
  const [{ data: parties }, { data: prefs }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, full_name, contact_email, email, timezone')
      .in('id', attendeeIds),
    supabase
      .from('notification_email_prefs')
      .select('member_id, meetings')
      .in('member_id', attendeeIds)
  ])
  const prefMap = new Map((prefs ?? []).map((p) => [p.member_id, p.meetings]))
  const pickUrl = absoluteUrl(`/dashboard?meetings=${request.id}`)
  await Promise.all(
    (parties ?? []).map(async (p) => {
      if (prefMap.get(p.id) === false) return
      const to = (p.contact_email && p.contact_email.trim()) || p.email
      if (!to) return
      const unsubscribeUrl = await buildUnsubscribeUrl(p.id)
      const { subject, html, text } = meetingApprovedEmail({
        recipientName: p.full_name,
        requesterName: request.requesterName,
        requesterAvatarUrl: request.requesterAvatarUrl,
        title: request.title,
        agenda: request.agenda,
        durationMin: request.durationMin,
        mode: request.mode,
        proposedDate: request.proposedDate,
        slotIsos: request.slots,
        goal: request.goal,
        context: request.context,
        questions: request.questions,
        pickUrl,
        recipientTimezone: p.timezone,
        unsubscribeUrl
      })
      const res = await dispatchEmail({
        memberId: p.id,
        to,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_approved'
      })
      if (res.ok) out.sent += 1
      else out.failures.push({ memberId: p.id, reason: res.reason })
    })
  )
  return out
}

// Fan out a "this was rescheduled" email to everyone who isn't the
// person who triggered the reschedule.
async function sendRescheduledEmail(
  request: MeetingRequest,
  rescheduledById: string,
  rescheduledByName: string,
  rescheduledByAvatarUrl: string | null,
  reason: string | null,
  needsPick: boolean
): Promise<EmailFanoutResult> {
  const out = emptyFanout()
  const supabase = createAdminClient()
  const recipientIds = [
    request.requesterId,
    ...request.attendees.map((a) => a.id)
  ].filter((id) => id !== rescheduledById)
  if (recipientIds.length === 0) return out

  const [{ data: parties }, { data: prefs }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, full_name, contact_email, email, timezone')
      .in('id', recipientIds),
    supabase
      .from('notification_email_prefs')
      .select('member_id, meetings')
      .in('member_id', recipientIds)
  ])
  const prefMap = new Map((prefs ?? []).map((p) => [p.member_id, p.meetings]))
  const openUrl = absoluteUrl(`/dashboard?meetings=${request.id}`)

  const isGroup = request.attendees.length >= 2
  const newLockedStartsAt =
    isGroup && request.mode === 'slots' ? request.selectedStartsAt : null
  const newProposedDate = isGroup ? null : request.proposedDate
  const newSlotIsos = !isGroup && request.mode === 'slots' ? request.slots : null

  await Promise.all(
    (parties ?? []).map(async (p) => {
      if (prefMap.get(p.id) === false) return
      const to = (p.contact_email && p.contact_email.trim()) || p.email
      if (!to) return
      const unsubscribeUrl = await buildUnsubscribeUrl(p.id)
      const { subject, html, text } = meetingRescheduledEmail({
        recipientName: p.full_name,
        rescheduledByName,
        rescheduledByAvatarUrl,
        title: request.title,
        durationMin: request.durationMin,
        newProposedDate,
        newSlotIsos,
        newLockedStartsAt,
        reason,
        openUrl,
        needsPick,
        recipientTimezone: p.timezone,
        unsubscribeUrl
      })
      const res = await dispatchEmail({
        memberId: p.id,
        to,
        subject,
        html,
        text,
        unsubscribeUrl,
        tag: 'meeting_rescheduled'
      })
      if (res.ok) out.sent += 1
      else out.failures.push({ memberId: p.id, reason: res.reason })
    })
  )
  return out
}

async function sendDeclinedOrRejectedEmail(
  request: MeetingRequest,
  label: 'Declined' | 'Rejected',
  declinerName: string,
  reason: string | null
): Promise<EmailFanoutResult> {
  const out = emptyFanout()
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
  if (!requester) return out
  if (pref?.meetings === false) return out
  const to = (requester.contact_email && requester.contact_email.trim()) || requester.email
  if (!to) return out
  const unsubscribeUrl = await buildUnsubscribeUrl(request.requesterId)
  const { subject, html, text } = meetingDeclinedOrRejectedEmail({
    recipientName: requester.full_name,
    declinerName,
    title: request.title,
    reason,
    reasonLabel: label,
    unsubscribeUrl
  })
  const res = await dispatchEmail({
    memberId: request.requesterId,
    to,
    subject,
    html,
    text,
    unsubscribeUrl,
    tag: label === 'Declined' ? 'meeting_declined' : 'meeting_rejected'
  })
  if (res.ok) out.sent += 1
  else out.failures.push({ memberId: request.requesterId, reason: res.reason })
  return out
}
