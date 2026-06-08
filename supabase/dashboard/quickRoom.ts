import 'server-only'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import { logActivity } from './mutations'

const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:\?.*)?$/i
// Rows older than this are considered stale (browser closed, network died).
// Browser heartbeats every 30s, so 2 minutes covers a couple of misses
// without dropping someone who's still genuinely in the room.
const PRESENCE_TTL_MS = 2 * 60 * 1000

async function sweepStale(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string
) {
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString()
  await supabase
    .from('quick_room_presence')
    .delete()
    .eq('company_id', companyId)
    .lt('last_heartbeat', cutoff)
}

export async function setQuickMeetUrl(
  rawUrl: string
): Promise<{ ok: true; url: string | null } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin') {
    return { error: 'Only admins can set the quick room URL.' }
  }
  const trimmed = rawUrl.trim()
  if (trimmed && !MEET_URL_RE.test(trimmed)) {
    return { error: 'Expected a meet.google.com/... URL.' }
  }
  const next = trimmed === '' ? null : trimmed
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('companies')
    .update({ quick_meet_url: next })
    .eq('id', member.companyId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, url: next }
}

export async function inviteToQuickRoom(
  memberIds: string[]
): Promise<{ ok: true; invited: number } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const ids = [...new Set(memberIds)].filter((id) => id && id !== member.id)
  if (ids.length === 0) return { error: 'Pick at least one teammate.' }

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('quick_meet_url')
    .eq('id', member.companyId)
    .maybeSingle()
  if (!company?.quick_meet_url) {
    return { error: 'No quick room URL set. Ask an admin to configure it.' }
  }

  // Validate invitees belong to the same company before broadcasting.
  const { data: validMembers } = await supabase
    .from('team_members')
    .select('id')
    .eq('company_id', member.companyId)
    .in('id', ids)
  const validIds = (validMembers ?? []).map((m) => m.id)
  if (validIds.length === 0) return { error: 'No valid teammates.' }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'room.invite',
    'room',
    undefined,
    {
      to: validIds,
      meetUrl: company.quick_meet_url,
      inviterName: member.fullName
    }
  )
  return { ok: true, invited: validIds.length }
}

export async function joinQuickRoom(): Promise<
  { ok: true } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  // Preserve joined_at if a row already exists by only updating the
  // heartbeat on conflict (insert-or-bump pattern).
  const { error } = await supabase
    .from('quick_room_presence')
    .upsert(
      {
        company_id: member.companyId,
        member_id: member.id,
        joined_at: now,
        last_heartbeat: now
      },
      { onConflict: 'company_id,member_id', ignoreDuplicates: false }
    )
  if (error) return { error: error.message }
  // Opportunistic cleanup so other clients' postgres_changes feed picks
  // up the DELETE events for stale presences without a separate cron.
  await sweepStale(supabase, member.companyId)
  return { ok: true }
}

export async function heartbeatQuickRoom(): Promise<
  { ok: true } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('quick_room_presence')
    .update({ last_heartbeat: new Date().toISOString() })
    .eq('company_id', member.companyId)
    .eq('member_id', member.id)
  if (error) return { error: error.message }
  await sweepStale(supabase, member.companyId)
  return { ok: true }
}

export async function leaveQuickRoom(): Promise<
  { ok: true } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('quick_room_presence')
    .delete()
    .eq('company_id', member.companyId)
    .eq('member_id', member.id)
  if (error) return { error: error.message }
  return { ok: true }
}
