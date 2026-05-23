import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { AccessTier, CrewMember } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOGIN_ROUTE, DEFAULT_REDIRECT_ROUTE } from "@/routes";

// Data Access Layer. Pattern from Next.js auth guide
// (node_modules/next/dist/docs/01-app/02-guides/authentication.md).
//
// Primitives:
//   - verifySession(): returns verified JWT claims, or redirects to /login.
//   - getCurrentCrewMember(): joins the auth user id to the matching crew_member
//     row via Prisma. Returns null if the auth user has no domain row yet
//     (this should never happen after slice 1 because seed creates both, but
//     real-world signup flows in later slices may have a brief window).
//   - requireAccessTier(allowed): ensures the current member's tier is in the
//     allowed list, otherwise redirects. Used by server actions for create /
//     destroy operations. See decision 0011.
//
// verifySession and getCurrentCrewMember are wrapped in React's cache() so a
// single render pass only verifies once even if many components ask. The
// cache resets between requests.

export const verifySession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }

  return data.claims;
});

export const getCurrentCrewMember = cache(async () => {
  const claims = await verifySession();
  const userId = claims.sub as string;

  return prisma.crewMember.findUnique({
    where: { id: userId },
  });
});

/**
 * Server-action / route-handler guard. Returns the current crew_member if
 * their access_tier is in the allowed list, otherwise redirects to /cockpit.
 *
 * Redirect (not throw) so server actions don't trigger Next's error overlay
 * for a perfectly normal "not authorized" outcome. See decision 0011.
 */
export async function requireAccessTier(
  allowed: readonly AccessTier[],
): Promise<CrewMember> {
  const member = await getCurrentCrewMember();
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }
  if (!allowed.includes(member.accessTier)) {
    redirect(DEFAULT_REDIRECT_ROUTE);
  }
  return member;
}
