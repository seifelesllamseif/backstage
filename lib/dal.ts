import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { AccessTier, TeamMember } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOGIN_ROUTE, DEFAULT_REDIRECT_ROUTE } from "@/routes";

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }

  return data.claims;
});

export const getCurrentTeamMember = cache(async () => {
  const claims = await verifySession();
  // INVARIANT: team_member.id === auth.users.id. The cross-schema FK that
  // enforced this was dropped in slice 2 (decisions 0002, 0016). A miss here
  // means a writer used the wrong id, not that the user is logged in wrong.
  const userId = claims.sub as string;

  return prisma.teamMember.findUnique({
    where: { id: userId },
  });
});

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
