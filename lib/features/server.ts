import 'server-only'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import type { AnyFeatureKey } from './keys'

export type WorkspaceSummary = {
  id: string
  name: string
  logoUrl: string | null
}

export type WorkspaceBranding = {
  enabledFeatures: AnyFeatureKey[]
  logoUrl: string | null
  companyId: string | null
  companyName: string | null
  // Every workspace this account belongs to (drives the sidebar switcher;
  // length 1 for classic single-workspace accounts).
  workspaces: WorkspaceSummary[]
}

const EMPTY_BRANDING: WorkspaceBranding = {
  enabledFeatures: [],
  logoUrl: null,
  companyId: null,
  companyName: null,
  workspaces: []
}

export const getWorkspaceBranding = cache(
  async (): Promise<WorkspaceBranding> => {
    const member = await getCurrentTeamMember()
    if (!member) return EMPTY_BRANDING
    const supabase = createAdminClient()
    // The FK hint is required: companies.owner_id also points at
    // team_members, so a bare companies(...) embed is ambiguous and
    // PostgREST rejects it.
    const { data, error } = await supabase
      .from('team_members')
      .select(
        'company_id, companies!crew_member_company_id_fkey(id, name, logo_url, enabled_features)'
      )
      .eq('user_id', member.userId)
    if (error) console.error('[branding] membership query failed', error)
    const rows = data ?? []
    const workspaces: WorkspaceSummary[] = rows.flatMap((r) =>
      r.companies
        ? [
            {
              id: r.companies.id,
              name: r.companies.name,
              logoUrl: r.companies.logo_url
            }
          ]
        : []
    )
    const active = rows.find(
      (r) => r.company_id === member.companyId
    )?.companies
    return {
      enabledFeatures:
        (active?.enabled_features as AnyFeatureKey[] | null) ?? [],
      logoUrl: active?.logo_url ?? null,
      companyId: member.companyId,
      companyName: active?.name ?? null,
      workspaces
    }
  }
)

export async function getEnabledFeatures(): Promise<AnyFeatureKey[]> {
  return (await getWorkspaceBranding()).enabledFeatures
}

export async function isFeatureEnabled(key: AnyFeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures()
  return enabled.includes(key)
}

export async function requireFeature(key: AnyFeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(key))) notFound()
}

// Company-scoped variant for callers that already know the workspace and
// have no session: plugin HTTP routes (see PLUGINS.md). The functions above
// all resolve the company from the session cookie via getCurrentTeamMember(),
// whose verifySession() redirects to /login — which would throw a Next
// redirect out of a route handler rather than returning false.
export async function isFeatureEnabledForCompany(
  companyId: string,
  key: AnyFeatureKey
): Promise<boolean> {
  const { data } = await createAdminClient()
    .from('companies')
    .select('enabled_features')
    .eq('id', companyId)
    .maybeSingle()
  return (data?.enabled_features ?? []).includes(key)
}
