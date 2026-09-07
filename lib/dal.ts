import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/admin'
import { getRequestIdentity } from '@/lib/requestIdentity'
import type { Database } from '@/supabase/types'
import {
  DEFAULT_LOGIN_ROUTE,
  DEFAULT_REDIRECT_ROUTE,
  ONBOARDING_ROUTE
} from '@/routes'

export type AccessTier = Database['public']['Enums']['access_tier']
export type ActivityStatus = Database['public']['Enums']['activity_status']

type TeamMemberRow = Database['public']['Tables']['team_members']['Row']

// camelCase mirror of the team_members row, preserved from the Prisma era so
// consumers (DashboardShell, actions.ts, onboarding) don't have to change.
export interface TeamMember {
  id: string
  // The auth account this membership belongs to (auth.users.id).
  userId: string
  companyId: string
  email: string
  slug: string | null
  fullName: string
  avatarUrl: string | null
  bio: string | null
  socialInstagram: string | null
  socialLinkedin: string | null
  socialWhatsapp: string | null
  languages: string[]
  profileTheme: string | null
  accessTier: AccessTier
  createdAt: string
  contactEmail: string | null
  roleFocus: string | null
  timezone: string | null
  workStyle: string | null
  headline: string | null
  workLinks: TeamMemberRow['work_links']
  skills: TeamMemberRow['skills']
  onboardingStep: number
  lastSeenAt: string | null
  activityStatus: ActivityStatus
}

export function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    email: row.email,
    slug: row.slug,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    socialInstagram: row.social_instagram,
    socialLinkedin: row.social_linkedin,
    socialWhatsapp: row.social_whatsapp,
    languages: row.languages,
    profileTheme: row.profile_theme,
    accessTier: row.access_tier,
    createdAt: row.created_at,
    contactEmail: row.contact_email,
    roleFocus: row.role_focus,
    timezone: row.timezone,
    workStyle: row.work_style,
    headline: row.headline,
    workLinks: row.work_links,
    skills: row.skills,
    onboardingStep: row.onboarding_step,
    lastSeenAt: row.last_seen_at,
    activityStatus: row.activity_status
  }
}

export const verifySession = cache(async () => {
  // Protocol clients (MCP bearer tokens) have already been verified at the
  // route boundary and carry no cookie. redirect() would throw a Next
  // redirect out of a route handler, so short-circuit before touching the
  // session client. See lib/requestIdentity.ts.
  const identity = getRequestIdentity()
  if (identity) return { sub: identity.userId }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect(DEFAULT_LOGIN_ROUTE)
  }

  return data.claims
})

// Cookie holding the active workspace's company id for accounts that
// belong to more than one. Read only here; set only by switchWorkspace.
const ACTIVE_WORKSPACE_COOKIE = 'bs-active-workspace'

export const getCurrentTeamMember = cache(
  async (): Promise<TeamMember | null> => {
    const claims = await verifySession()
    // INVARIANT: team_member.user_id === auth.users.id, one membership row
    // per (user, workspace); founders' rows also have id === user_id for
    // history (decisions 0002, 0016). A miss here means a writer used the
    // wrong id, not that the user is logged in wrong.
    const userId = claims.sub as string

    // Overridden identity names its workspace explicitly, so there is
    // nothing to disambiguate: select that one membership. The admin client
    // is required — a bearer request has no cookie session for RLS to key
    // on, so the session client would return zero rows. Safe: both ids come
    // from a verified credential, and (user_id, company_id) is unique
    // (team_members_user_company_uidx).
    const identity = getRequestIdentity()
    if (identity) {
      const { data: row } = await createAdminClient()
        .from('team_members')
        .select('*')
        .eq('user_id', identity.userId)
        .eq('company_id', identity.companyId)
        .maybeSingle()
      if (!row) return null
      const member = toTeamMember(row)
      // A removed member's access token stays signature-valid until it
      // expires, so the ban is invisible to signature checks. Browsers are
      // covered by requireOnboardingComplete(); this is the token analogue.
      return member.activityStatus === 'left' ? null : member
    }

    const supabase = await createClient()
    const { data: rows } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)

    if (!rows || rows.length === 0) return null
    if (rows.length === 1) return toTeamMember(rows[0])

    // Multiple memberships: the per-device cookie picks; a stale or absent
    // cookie falls back to the most recently used membership.
    const active = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value
    const pick =
      rows.find((r) => r.company_id === active) ??
      [...rows].sort((a, b) =>
        (b.last_seen_at ?? b.created_at).localeCompare(
          a.last_seen_at ?? a.created_at
        )
      )[0]
    return toTeamMember(pick)
  }
)

// Redirects rather than throws so server actions don't trip Next's error
// overlay on a normal "not authorized" outcome. Decision 0011.
export async function requireAccessTier(
  allowed: readonly AccessTier[]
): Promise<TeamMember> {
  const member = await getCurrentTeamMember()
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE)
  }
  if (!allowed.includes(member.accessTier)) {
    redirect(DEFAULT_REDIRECT_ROUTE)
  }
  return member
}

// Decision 0029: avatar_url IS NULL is the canonical "still needs onboarding"
// signal. Workspace layout calls this after verifySession() to gate the app
// shell behind a completed wizard.
export const requireOnboardingComplete = cache(async () => {
  const member = await getCurrentTeamMember()
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE)
  }
  // Soft-removed members (activity_status='left') must not see the
  // workspace. We bounce them through /api/auth/signout, which runs
  // in a route handler that CAN clear auth cookies (server components
  // can't, see supabase/server.ts setAll). Trying to signOut() inline
  // here silently fails, the proxy keeps seeing them as authed, and
  // they get bounced between /login and /dashboard in a refresh loop.
  if (member.activityStatus === 'left') {
    redirect('/api/auth/signout?reason=left')
  }
  if (!member.avatarUrl) {
    redirect(ONBOARDING_ROUTE)
  }
  return member
})

// Bumps last_seen_at on the caller's own row. Fired from the workspace layout
// inside Next's after() helper, which runs after the response is sent and
// disallows cookies(). The user-session client depends on cookies, so we use
// the service-role admin client here; safety comes from the caller having
// already passed requireOnboardingComplete() with this exact memberId.
export async function touchLastSeen(memberId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('team_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', memberId)
}

// Read-time derivation of presence. Stored activity_status stays 'active'
// until manually changed (on_vacation, left), so we surface 'away' here based
// on staleness of last_seen_at rather than writing it back.
const AWAY_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function derivePresence(member: TeamMember): ActivityStatus {
  if (member.activityStatus !== 'active') return member.activityStatus
  if (!member.lastSeenAt) return 'away'
  const stale =
    Date.now() - new Date(member.lastSeenAt).getTime() > AWAY_AFTER_MS
  return stale ? 'away' : 'active'
}
