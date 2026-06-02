import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireOnboardingComplete } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import { canSeeTeamPage } from '@/lib/teamGate'
import { DEFAULT_REDIRECT_ROUTE } from '@/routes'
import { dashboardMetadata } from '../_components/fetchInitial'

type SearchParams = Promise<{ project?: string }>

export async function generateMetadata({
  searchParams
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const { project } = await searchParams
  return dashboardMetadata(project)
}

// Server-side gate so members never see the empty "Not allowed" state
// from listTeamRoster. The DashboardShell hides the sidebar Team entry
// for members; this is the defense-in-depth path when somebody types
// the URL or follows an old bookmark. Listed in `staffOnlyRoutes` in
// /routes.ts as the single source of truth for tier-gated paths.
export default async function TeamPage() {
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
