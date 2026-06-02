'use server'

import { acceptInvite as acceptInviteImpl } from '@/supabase/dashboard/team'

export async function acceptInvite(
  ...args: Parameters<typeof acceptInviteImpl>
) {
  return acceptInviteImpl(...args)
}
