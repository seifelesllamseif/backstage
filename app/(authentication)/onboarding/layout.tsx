import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/dal";
import { DEFAULT_LOGIN_ROUTE, DEFAULT_REDIRECT_ROUTE } from "@/routes";

// Decision 0029: members reach /onboarding when they have a session but
// haven't finished the wizard yet. We gate by onboarding_step rather than
// avatar_url so the optional steps after the avatar (socials, about) remain
// accessible: avatar marks them "in the app" but not "wizard complete".
//
// Redirect to /dashboard once onboarding_step >= WIZARD_STEPS — at that
// point the wizard has nothing left to show.
//
// Wrapped in Suspense to satisfy Next.js 16 cacheComponents: the await on
// getCurrentTeamMember () (which calls supabase.auth.getClaims()) is uncached
// and would otherwise block route rendering.

const WIZARD_STEPS = 5;

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <Gated>{children}</Gated>
    </Suspense>
  );
}

async function Gated({ children }: { children: React.ReactNode }) {
  const member = await getCurrentTeamMember();
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }
  if (member.onboardingStep >= WIZARD_STEPS) {
    redirect(DEFAULT_REDIRECT_ROUTE);
  }
  return <>{children}</>;
}
