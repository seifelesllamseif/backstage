import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import type { Database } from "@/supabase/types";
import {
  DEFAULT_LOGIN_ROUTE,
  DEFAULT_REDIRECT_ROUTE,
  ONBOARDING_ROUTE,
} from "@/routes";

export type AccessTier = Database["public"]["Enums"]["access_tier"];
export type ActivityStatus = Database["public"]["Enums"]["activity_status"];

type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];

// camelCase mirror of the team_members row, preserved from the Prisma era so
// consumers (DashboardShell, actions.ts, onboarding) don't have to change.
export interface TeamMember {
  id: string;
  companyId: string;
  email: string;
  slug: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  socialInstagram: string | null;
  socialLinkedin: string | null;
  socialWhatsapp: string | null;
  languages: string[];
  profileTheme: string | null;
  accessTier: AccessTier;
  createdAt: string;
  contactEmail: string | null;
  roleFocus: string | null;
  timezone: string | null;
  workStyle: string | null;
  headline: string | null;
  workLinks: TeamMemberRow["work_links"];
  skills: TeamMemberRow["skills"];
  onboardingStep: number;
  lastSeenAt: string | null;
  activityStatus: ActivityStatus;
}

export function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
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
    activityStatus: row.activity_status,
  };
}

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }

  return data.claims;
});

export const getCurrentTeamMember = cache(
  async (): Promise<TeamMember | null> => {
    const claims = await verifySession();
    // INVARIANT: team_member.id === auth.users.id. The cross-schema FK that
    // enforced this was dropped in slice 2 (decisions 0002, 0016). A miss here
    // means a writer used the wrong id, not that the user is logged in wrong.
    const userId = claims.sub as string;

    const supabase = await createClient();
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return data ? toTeamMember(data) : null;
  },
);

// Redirects rather than throws so server actions don't trip Next's error
// overlay on a normal "not authorized" outcome. Decision 0011.
export async function requireAccessTier(
  allowed: readonly AccessTier[],
): Promise<TeamMember> {
  const member = await getCurrentTeamMember();
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }
  if (!allowed.includes(member.accessTier)) {
    redirect(DEFAULT_REDIRECT_ROUTE);
  }
  return member;
}

// Decision 0029: avatar_url IS NULL is the canonical "still needs onboarding"
// signal. Workspace layout calls this after verifySession() to gate the app
// shell behind a completed wizard.
export const requireOnboardingComplete = cache(async () => {
  const member = await getCurrentTeamMember();
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }
  // Soft-removed members (activity_status='left') must not see the
  // workspace. We bounce them through /api/auth/signout, which runs
  // in a route handler that CAN clear auth cookies (server components
  // can't, see supabase/server.ts setAll). Trying to signOut() inline
  // here silently fails, the proxy keeps seeing them as authed, and
  // they get bounced between /login and /dashboard in a refresh loop.
  if (member.activityStatus === "left") {
    redirect("/api/auth/signout?reason=left");
  }
  if (!member.avatarUrl) {
    redirect(ONBOARDING_ROUTE);
  }
  return member;
});

// Bumps last_seen_at on the caller's own row. Fired from the workspace layout
// inside Next's after() helper, which runs after the response is sent and
// disallows cookies(). The user-session client depends on cookies, so we use
// the service-role admin client here; safety comes from the caller having
// already passed requireOnboardingComplete() with this exact memberId.
export async function touchLastSeen(memberId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("team_members")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", memberId);
}

// Read-time derivation of presence. Stored activity_status stays 'active'
// until manually changed (on_vacation, left), so we surface 'away' here based
// on staleness of last_seen_at rather than writing it back.
const AWAY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function derivePresence(member: TeamMember): ActivityStatus {
  if (member.activityStatus !== "active") return member.activityStatus;
  if (!member.lastSeenAt) return "away";
  const stale = Date.now() - new Date(member.lastSeenAt).getTime() > AWAY_AFTER_MS;
  return stale ? "away" : "active";
}
