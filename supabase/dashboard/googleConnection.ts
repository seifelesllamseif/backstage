import 'server-only'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import { googleConfigured } from '@/lib/google/oauth'

// Server actions for the "Connect Google Calendar" affordance in
// Settings. The OAuth dance itself runs through the API routes under
// /api/google/oauth - this file just exposes read + disconnect.

export interface GoogleConnectionStatus {
  configured: boolean
  connected: boolean
  connectedAt: string | null
  lastUsedAt: string | null
  googleEmail: string | null
  connectedByMemberId: string | null
  connectedByName: string | null
}

export async function getGoogleConnectionStatus(): Promise<
  GoogleConnectionStatus | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const configured = googleConfigured()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('google_oauth_tokens')
    .select(
      'connected_at, last_used_at, google_email, member_id, member:team_members!google_oauth_tokens_member_id_fkey(full_name)'
    )
    .eq('company_id', member.companyId)
    .maybeSingle()

  if (!data) {
    return {
      configured,
      connected: false,
      connectedAt: null,
      lastUsedAt: null,
      googleEmail: null,
      connectedByMemberId: null,
      connectedByName: null
    }
  }
  const connectedByName = (
    data.member as { full_name: string } | null
  )?.full_name ?? null
  return {
    configured,
    connected: true,
    connectedAt: data.connected_at,
    lastUsedAt: data.last_used_at,
    googleEmail: data.google_email,
    connectedByMemberId: data.member_id,
    connectedByName
  }
}

export async function disconnectGoogle(): Promise<{ ok: true } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  if (member.accessTier !== 'admin') {
    return { error: 'Only an admin can disconnect the workspace calendar.' }
  }
  const supabase = createAdminClient()
  await supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('company_id', member.companyId)
  revalidatePath('/dashboard')
  return { ok: true }
}
