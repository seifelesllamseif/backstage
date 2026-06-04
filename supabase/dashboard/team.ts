import 'server-only'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/supabase/admin'
import { createClient } from '@/supabase/server'
import { getCurrentTeamMember } from '@/lib/dal'
import { absoluteUrl, sendEmail } from '@/lib/email/send'
import { inviteMemberEmail } from '@/lib/email/templates'
import { logActivity } from './mutations'
import {
  canCancelInvite,
  canChangeTier,
  canEditProfile,
  canInvite,
  canReinstate,
  canSeeTeamPage,
  canSoftRemove,
  type AccessTier,
  type Actor,
  type Target
} from '@/lib/teamGate'

const INVITE_EXPIRY_DAYS = 14

export interface TeamRosterMember {
  id: string
  fullName: string
  email: string
  contactEmail: string | null
  avatarUrl: string | null
  headline: string | null
  accessTier: AccessTier
  activityStatus: 'active' | 'away' | 'on_vacation' | 'left'
  lastSeenAt: string | null
  isOwner: boolean
}

export interface TeamRosterInvite {
  id: string
  email: string
  fullName: string
  accessTier: AccessTier
  invitedAt: string
  expiresAt: string
  invitedById: string | null
  invitedByName: string | null
}

export interface TeamRoster {
  actor: Actor
  members: TeamRosterMember[]
  invites: TeamRosterInvite[]
}

async function loadActor(): Promise<Actor | null> {
  const member = await getCurrentTeamMember()
  if (!member) return null
  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('owner_id')
    .eq('id', member.companyId)
    .maybeSingle()
  return {
    id: member.id,
    accessTier: member.accessTier,
    isOwner: company?.owner_id === member.id
  }
}

async function toTarget(
  companyId: string,
  memberId: string
): Promise<Target | null> {
  const supabase = createAdminClient()
  const [{ data: member }, { data: company }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, access_tier, company_id')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .maybeSingle()
  ])
  if (!member) return null
  return {
    id: member.id,
    accessTier: member.access_tier,
    isOwner: company?.owner_id === member.id
  }
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function listTeamRoster(): Promise<
  { roster: TeamRoster } | { error: string }
> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  if (!canSeeTeamPage(actor)) return { error: 'Not allowed.' }

  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const [{ data: company }, { data: members }, { data: invites }] =
    await Promise.all([
      supabase
        .from('companies')
        .select('owner_id')
        .eq('id', me.companyId)
        .maybeSingle(),
      supabase
        .from('team_members')
        .select(
          'id, full_name, email, contact_email, avatar_url, headline, access_tier, activity_status, last_seen_at'
        )
        .eq('company_id', me.companyId)
        .order('full_name'),
      supabase
        .from('team_invites')
        .select(
          'id, email, full_name, access_tier, invited_at, expires_at, invited_by, inviter:team_members!team_invites_invited_by_fkey(full_name)'
        )
        .eq('company_id', me.companyId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false })
    ])

  const ownerId = company?.owner_id ?? null

  const roster: TeamRoster = {
    actor,
    members: (members ?? []).map((m) => ({
      id: m.id,
      fullName: m.full_name,
      email: m.email,
      contactEmail: m.contact_email,
      avatarUrl: m.avatar_url,
      headline: m.headline,
      accessTier: m.access_tier,
      activityStatus: m.activity_status,
      lastSeenAt: m.last_seen_at,
      isOwner: m.id === ownerId
    })),
    invites: (invites ?? []).map((i) => {
      const inviter = i.inviter as { full_name: string } | null
      return {
        id: i.id,
        email: i.email,
        fullName: i.full_name,
        accessTier: i.access_tier,
        invitedAt: i.invited_at,
        expiresAt: i.expires_at,
        invitedById: i.invited_by,
        invitedByName: inviter?.full_name ?? null
      }
    })
  }

  return { roster }
}

// ── Invite ────────────────────────────────────────────────────────────────

// The fixed initial password for invited accounts. The recipient is told
// this in the invite email and is forced to change it on first sign-in
// via the existing onboarding step-1 password gate (see
// app/(authentication)/onboarding/actions.ts updatePassword).
export const INVITE_DEFAULT_PASSWORD = 'AStrong1!'

const LOGIN_EMAIL_DOMAIN = 'verbivore.app'

const InviteInput = z.object({
  // The contact email the admin types - where the invite mail is sent
  // and what becomes the recipient's contact_email on team_members.
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email.'),
  fullName: z.string().trim().min(1, 'Name is required.').max(120),
  accessTier: z.enum(['admin', 'lead', 'member'])
})

// "Jane Doe" -> "jane.doe". Strips non-alphanumeric, collapses whitespace
// to a single dot. Used to build a stable workspace login email.
function slugifyForLogin(fullName: string): string {
  const cleaned = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'member'
  return parts.join('.')
}

// Picks an unused jane.doe@verbivore.app handle. Appends a numeric
// suffix on collision (with both existing team_members emails and
// pending invite emails). The lookup is case-insensitive because the
// auth schema treats emails that way.
async function pickLoginEmail(
  supabase: ReturnType<typeof createAdminClient>,
  fullName: string
): Promise<string> {
  const handle = slugifyForLogin(fullName)
  const tryEmail = (suffix: number) =>
    suffix === 0
      ? `${handle}@${LOGIN_EMAIL_DOMAIN}`
      : `${handle}${suffix}@${LOGIN_EMAIL_DOMAIN}`

  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = tryEmail(suffix)
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('team_members')
        .select('id')
        .ilike('email', candidate)
        .maybeSingle(),
      supabase
        .from('team_invites')
        .select('id')
        .ilike('email', candidate)
        .is('accepted_at', null)
        .maybeSingle()
    ])
    if (!membersRes.data && !invitesRes.data) return candidate
  }
  // Extremely unlikely fallback - 100 collisions on the same handle.
  return `${handle}.${Date.now()}@${LOGIN_EMAIL_DOMAIN}`
}

export async function inviteMember(
  input: z.input<typeof InviteInput>
): Promise<
  | {
      ok: true
      loginEmail: string
      emailStatus: { ok: true } | { ok: false; reason: string }
    }
  | { error: string }
> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }

  const parsed = InviteInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  if (!canInvite(actor, parsed.data.accessTier)) {
    return { error: 'You can only invite at that tier if you are an admin or owner.' }
  }

  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  // Block invites that collide on contact email with an existing active
  // member. (Login email collisions are handled separately by pickLoginEmail.)
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, activity_status')
    .eq('company_id', me.companyId)
    .ilike('contact_email', parsed.data.contactEmail)
    .maybeSingle()
  if (existing && existing.activity_status !== 'left') {
    return { error: 'That contact email is already on the team.' }
  }

  // Cancel any prior pending invite for the same contact email to keep
  // the recipient's inbox clean and avoid stale tokens floating around.
  await supabase
    .from('team_invites')
    .delete()
    .eq('company_id', me.companyId)
    .is('accepted_at', null)
    .ilike('contact_email', parsed.data.contactEmail)

  const loginEmail = await pickLoginEmail(supabase, parsed.data.fullName)

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: invite, error: insertErr } = await supabase
    .from('team_invites')
    .insert({
      company_id: me.companyId,
      email: loginEmail,
      contact_email: parsed.data.contactEmail,
      full_name: parsed.data.fullName,
      access_tier: parsed.data.accessTier,
      token,
      invited_by: me.id,
      expires_at: expiresAt
    })
    .select('id')
    .single()
  if (insertErr || !invite) {
    return { error: insertErr?.message ?? 'Invite failed.' }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', me.companyId)
    .maybeSingle()

  const { subject, html, text } = inviteMemberEmail({
    recipientName: parsed.data.fullName,
    inviterName: me.fullName,
    companyName: company?.name ?? 'Backstage',
    accessTier: parsed.data.accessTier,
    loginEmail,
    initialPassword: INVITE_DEFAULT_PASSWORD,
    acceptUrl: absoluteUrl(`/invite/${token}`),
    loginUrl: absoluteUrl('/login'),
    expiresAt
  })

  const emailResult = await sendInviteEmailSafely({
    to: parsed.data.contactEmail,
    subject,
    html,
    text
  })

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.invited',
    'team_invite',
    invite.id,
    {
      email: loginEmail,
      contactEmail: parsed.data.contactEmail,
      fullName: parsed.data.fullName,
      accessTier: parsed.data.accessTier,
      emailOk: emailResult.ok,
      emailReason: emailResult.ok ? null : emailResult.reason
    }
  )

  revalidatePath('/dashboard/team')
  return { ok: true, loginEmail, emailStatus: emailResult }
}

// Wrapper around sendEmail that records the failure reason and prints
// it into Vercel runtime logs instead of swallowing it. Mirrors the
// dispatchEmail helper in meetings.ts.
async function sendInviteEmailSafely(input: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tag: 'invite'
    })
    if (!res.ok) {
      const reason = res.reason ?? 'unknown'
      console.error(
        `[team-invite] send failed to=${input.to} reason=${reason}`
      )
      return { ok: false, reason }
    }
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err).slice(0, 200)
    console.error(`[team-invite] send threw to=${input.to}:`, err)
    return { ok: false, reason: message }
  }
}

// Re-fire the invite email for an existing pending invite. Useful
// when the original Resend call silently failed (no API key, rate
// limit, etc) and the row sits in team_invites with no email having
// reached the recipient.
export async function resendInvite(
  inviteId: string
): Promise<
  | { ok: true; emailStatus: { ok: true } | { ok: false; reason: string } }
  | { error: string }
> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data: invite } = await supabase
    .from('team_invites')
    .select(
      'id, email, contact_email, full_name, access_tier, token, expires_at, accepted_at, company_id'
    )
    .eq('id', inviteId)
    .maybeSingle()
  if (!invite) return { error: 'Invite not found.' }
  if (invite.company_id !== me.companyId) {
    return { error: 'Invite not found.' }
  }
  if (!canInvite(actor, invite.access_tier)) {
    return { error: 'Only admins and leads can resend invites.' }
  }
  if (invite.accepted_at) {
    return { error: 'This invite has already been accepted.' }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', invite.company_id)
    .maybeSingle()

  const { subject, html, text } = inviteMemberEmail({
    recipientName: invite.full_name,
    inviterName: me.fullName,
    companyName: company?.name ?? 'Backstage',
    accessTier: invite.access_tier,
    loginEmail: invite.email,
    initialPassword: INVITE_DEFAULT_PASSWORD,
    acceptUrl: absoluteUrl(`/invite/${invite.token}`),
    loginUrl: absoluteUrl('/login'),
    expiresAt: invite.expires_at
  })

  const emailResult = await sendInviteEmailSafely({
    to: invite.contact_email,
    subject,
    html,
    text
  })

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.invite_resent',
    'team_invite',
    invite.id,
    {
      email: invite.email,
      contactEmail: invite.contact_email,
      emailOk: emailResult.ok,
      emailReason: emailResult.ok ? null : emailResult.reason
    }
  )

  revalidatePath('/dashboard/team')
  return { ok: true, emailStatus: emailResult }
}

export async function cancelInvite(
  inviteId: string
): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }

  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: invite } = await supabase
    .from('team_invites')
    .select('access_tier, company_id, accepted_at')
    .eq('id', inviteId)
    .maybeSingle()
  if (!invite || invite.company_id !== me.companyId) {
    return { error: 'Invite not found.' }
  }
  if (invite.accepted_at) {
    return { error: 'That invite was already accepted.' }
  }
  if (!canCancelInvite(actor, invite.access_tier)) {
    return { error: 'Not allowed.' }
  }

  await supabase.from('team_invites').delete().eq('id', inviteId)
  revalidatePath('/dashboard/team')
  return { ok: true }
}

// ── Remove / reinstate ────────────────────────────────────────────────────

// Sets activity_status on the target. Mirrors softRemoveMember /
// reinstateMember gating: leads can only change member-tier targets,
// admins everyone except owner, owner anyone. Distinct from
// updateMemberActivityStatus in mutations.ts, which only checks the
// viewer's tier (not the target) and would let a lead flip an admin
// to 'left' bypassing the team gate.
const PRESENCE_VALUES = ['active', 'on_vacation', 'left'] as const
type PresenceValue = (typeof PRESENCE_VALUES)[number]

// Soft-removing a member must also kill their sessions. Without this
// they stay signed in - their cookie remains valid until expiry. We
// revoke refresh tokens (signOut global) so the next access-token
// refresh fails, and ban the auth user so they can't re-sign-in. The
// workspace layout has a complementary check that bounces 'left'
// members within the current access-token window. Unbanning happens
// inside applyPresence when the target is moving away from 'left'.
async function applyAuthSideEffectsForPresence(
  memberId: string,
  next: PresenceValue,
  prev: PresenceValue | null
): Promise<void> {
  const supabase = createAdminClient()
  if (next === 'left') {
    await supabase.auth.admin.signOut(memberId, 'global').catch(() => undefined)
    // ban_duration accepts a Go duration string; ~114 years is "forever
    // for our purposes". Reinstate clears it back to 'none'.
    await supabase.auth.admin
      .updateUserById(memberId, { ban_duration: '1000000h' })
      .catch(() => undefined)
    return
  }
  // Reinstating: only bother unbanning if they were left before.
  if (prev === 'left') {
    await supabase.auth.admin
      .updateUserById(memberId, { ban_duration: 'none' })
      .catch(() => undefined)
  }
}

export async function setMemberPresence(input: {
  memberId: string
  status: PresenceValue
}): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }

  if (!PRESENCE_VALUES.includes(input.status)) {
    return { error: 'Invalid status.' }
  }

  const target = await toTarget(me.companyId, input.memberId)
  if (!target) return { error: 'Member not found.' }

  // Use the same gate as soft-remove/reinstate. Both work because
  // canActOn (which both helpers wrap) returns the same answer.
  if (!canSoftRemove(actor, target)) return { error: 'Not allowed.' }

  const supabase = createAdminClient()
  // Read prior status to know whether to unban on reinstate.
  const { data: prevRow } = await supabase
    .from('team_members')
    .select('activity_status')
    .eq('id', input.memberId)
    .eq('company_id', me.companyId)
    .maybeSingle()
  const prevStatus = (prevRow?.activity_status ?? null) as
    | PresenceValue
    | 'away'
    | null

  const { error } = await supabase
    .from('team_members')
    .update({ activity_status: input.status })
    .eq('id', input.memberId)
    .eq('company_id', me.companyId)
  if (error) return { error: error.message }

  await applyAuthSideEffectsForPresence(
    input.memberId,
    input.status,
    prevStatus === 'away' ? 'active' : prevStatus
  )

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.presence_changed',
    'team_member',
    input.memberId,
    { from: prevStatus, to: input.status }
  )

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function softRemoveMember(
  memberId: string
): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }

  const target = await toTarget(me.companyId, memberId)
  if (!target) return { error: 'Member not found.' }
  if (!canSoftRemove(actor, target)) return { error: 'Not allowed.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update({ activity_status: 'left' })
    .eq('id', memberId)
    .eq('company_id', me.companyId)
  if (error) return { error: error.message }

  await applyAuthSideEffectsForPresence(memberId, 'left', null)

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.removed',
    'team_member',
    memberId
  )

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function reinstateMember(
  memberId: string
): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }

  const target = await toTarget(me.companyId, memberId)
  if (!target) return { error: 'Member not found.' }
  if (!canReinstate(actor, target)) return { error: 'Not allowed.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update({ activity_status: 'active' })
    .eq('id', memberId)
    .eq('company_id', me.companyId)
  if (error) return { error: error.message }

  await applyAuthSideEffectsForPresence(memberId, 'active', 'left')

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.reinstated',
    'team_member',
    memberId
  )

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ── Change tier ───────────────────────────────────────────────────────────

const ChangeTierInput = z.object({
  memberId: z.string().uuid(),
  newTier: z.enum(['admin', 'lead', 'member'])
})

export async function changeAccessTier(
  input: z.input<typeof ChangeTierInput>
): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }

  const parsed = ChangeTierInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const target = await toTarget(me.companyId, parsed.data.memberId)
  if (!target) return { error: 'Member not found.' }
  if (!canChangeTier(actor, target, parsed.data.newTier)) {
    return { error: 'Not allowed.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update({ access_tier: parsed.data.newTier })
    .eq('id', parsed.data.memberId)
    .eq('company_id', me.companyId)
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.tier_changed',
    'team_member',
    parsed.data.memberId,
    { from: target.accessTier, to: parsed.data.newTier }
  )

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ── Edit profile by admin ─────────────────────────────────────────────────

const EditProfileInput = z.object({
  memberId: z.string().uuid(),
  fullName: z.string().trim().min(1, 'Name is required.').max(120),
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email.')
    .or(z.literal('').transform(() => null))
    .nullable(),
  headline: z
    .string()
    .trim()
    .max(140, 'Headline must be 140 characters or fewer.')
    .or(z.literal('').transform(() => null))
    .nullable()
})

export async function updateMemberProfileByAdmin(
  input: z.input<typeof EditProfileInput>
): Promise<{ ok: true } | { error: string }> {
  const actor = await loadActor()
  if (!actor) return { error: 'Not signed in.' }
  const me = await getCurrentTeamMember()
  if (!me) return { error: 'Not signed in.' }

  const parsed = EditProfileInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const target = await toTarget(me.companyId, parsed.data.memberId)
  if (!target) return { error: 'Member not found.' }
  if (!canEditProfile(actor, target)) return { error: 'Not allowed.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update({
      full_name: parsed.data.fullName,
      contact_email: parsed.data.contactEmail,
      headline: parsed.data.headline
    })
    .eq('id', parsed.data.memberId)
    .eq('company_id', me.companyId)
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    me.companyId,
    me.id,
    'team.profile_edited',
    'team_member',
    parsed.data.memberId,
    {
      fullName: parsed.data.fullName,
      contactEmail: parsed.data.contactEmail
    }
  )

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ── Accept invite (called from the public /invite/[token] route) ──────────

export async function acceptInvite(input: {
  token: string
}): Promise<
  | { ok: true; loginEmail: string }
  | { error: string }
> {
  if (!input.token) return { error: 'Invite not found.' }
  const supabase = createAdminClient()

  const { data: invite } = await supabase
    .from('team_invites')
    .select('*')
    .eq('token', input.token)
    .maybeSingle()
  if (!invite) return { error: 'Invite not found.' }
  if (invite.accepted_at) return { error: 'That invite was already used.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: 'That invite has expired.' }
  }

  // Create the auth.users entry first - the team_members row needs to
  // point at its id. The fixed default password is INVITE_DEFAULT_PASSWORD
  // (also surfaced in the invite email); the recipient is forced to
  // change it via the onboarding-step-1 gate on first sign-in.
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email: invite.email,
    password: INVITE_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name }
  })
  if (authErr || !created?.user) {
    return { error: authErr?.message ?? 'Could not create account.' }
  }

  const { error: tmErr } = await supabase.from('team_members').insert({
    id: created.user.id,
    company_id: invite.company_id,
    email: invite.email,
    contact_email: invite.contact_email,
    full_name: invite.full_name,
    access_tier: invite.access_tier
  })
  if (tmErr) {
    // Roll back the auth user so a retry can succeed.
    await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined)
    return { error: tmErr.message }
  }

  await supabase
    .from('team_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Sign the user in so the next request lands inside the workspace.
  // SSR client sets the session cookie; the admin client never could.
  const ssr = await createClient()
  await ssr.auth.signInWithPassword({
    email: invite.email,
    password: INVITE_DEFAULT_PASSWORD
  })

  return { ok: true, loginEmail: invite.email }
}

// Light read for the /invite/[token] page so it can show the company
// name, role, and the login credentials to expect before the recipient
// clicks Accept.
export async function fetchInviteByToken(
  token: string
): Promise<
  | {
      invite: {
        loginEmail: string
        contactEmail: string
        fullName: string
        accessTier: AccessTier
        companyName: string
        inviterName: string | null
        expiresAt: string
      }
    }
  | { error: string }
> {
  if (!token) return { error: 'Invite not found.' }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_invites')
    .select(
      'email, contact_email, full_name, access_tier, accepted_at, expires_at, company:companies(name), inviter:team_members!team_invites_invited_by_fkey(full_name)'
    )
    .eq('token', token)
    .maybeSingle()
  if (!data) return { error: 'Invite not found.' }
  if (data.accepted_at) return { error: 'That invite was already used.' }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { error: 'That invite has expired.' }
  }
  const company = data.company as { name: string } | null
  const inviter = data.inviter as { full_name: string } | null
  return {
    invite: {
      loginEmail: data.email,
      contactEmail: data.contact_email,
      fullName: data.full_name,
      accessTier: data.access_tier,
      companyName: company?.name ?? 'Backstage',
      inviterName: inviter?.full_name ?? null,
      expiresAt: data.expires_at
    }
  }
}
