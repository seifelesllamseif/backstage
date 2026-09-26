import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireOnboardingComplete } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import { canSeeTeamPage } from '@/lib/teamGate'
import { DEFAULT_REDIRECT_ROUTE } from '@/routes'
import { panelMetadata } from '../_components/panelMetadata'

export const metadata = panelMetadata('Team')

// Server-side gate so members never see the empty "Not allowed" state
// from listTeamRoster. The DashboardShell hides the sidebar Team entry
// for members; this is the defense-in-depth path when somebody types
// the URL or follows an old bookmark. Listed in `staffOnlyRoutes` in
// /routes.ts as the single source of truth for tier-gated paths.
//
// Inside Suspense so the two round trips it costs don't sit in front of
// the panel swap - the gate still runs, it just runs while the (already
// client-rendered) panel is on screen.
export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <StaffGate />
    </Suspense>
  )
}

async function StaffGate() {
  const member = await requireOnboardingComplete()
  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('owner_id')
    .eq('id', member.companyId)
    .maybeSingle()
  const allowed = canSeeTeamPage({
    id: member.id,
    accessTier: member.accessTier,
    isOwner: company?.owner_id === member.id
  })
  if (!allowed) {
    redirect(DEFAULT_REDIRECT_ROUTE)
  }
  return null
}
