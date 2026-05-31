import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import type { Database } from "@/supabase/types";
import {
  DEFAULT_LOGIN_ROUTE,
  DEFAULT_REDIRECT_ROUTE,
  ONBOARDING_ROUTE,
} from "@/routes";

export type AccessTier = Database["public"]["Enums"]["access_tier"];

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
  if (!member.avatarUrl) {
    redirect(ONBOARDING_ROUTE);
  }
  return member;
});
