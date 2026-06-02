import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'

export interface EmailPrefs {
  mentions: boolean
  assigned: boolean
  meetings: boolean
}

const DEFAULT_PREFS: EmailPrefs = {
  mentions: true,
  assigned: true,
  meetings: true
}

export async function getMyEmailPrefs(): Promise<
  { prefs: EmailPrefs } | { error: string }
> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notification_email_prefs')
    .select('mentions, assigned, meetings')
    .eq('member_id', member.id)
    .maybeSingle()
  return {
    prefs: data
      ? {
          mentions: data.mentions,
          assigned: data.assigned,
          meetings: data.meetings
        }
      : DEFAULT_PREFS
  }
}

export async function updateMyEmailPrefs(
  patch: Partial<EmailPrefs>
): Promise<{ prefs: EmailPrefs } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const next = {
    member_id: member.id,
    ...('mentions' in patch ? { mentions: patch.mentions } : {}),
    ...('assigned' in patch ? { assigned: patch.assigned } : {}),
    ...('meetings' in patch ? { meetings: patch.meetings } : {}),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('notification_email_prefs')
    .upsert(next, { onConflict: 'member_id' })
    .select('mentions, assigned, meetings')
    .single()
  if (error || !data) return { error: error?.message ?? 'Update failed.' }
  return {
    prefs: {
      mentions: data.mentions,
      assigned: data.assigned,
      meetings: data.meetings
    }
  }
}
