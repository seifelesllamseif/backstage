import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/dal";
import { DEFAULT_LOGIN_ROUTE } from "@/routes";

// Decision 0029 (revised): members reach /onboarding the first time they
// have a session but haven't finished the wizard, AND any time later
// when they want to fill in the optional fields they skipped. We no
// longer hard-redirect 'completed' members away. The wizard itself
// shows 'Keep current ...' skips on every step that already has data.
//
// Wrapped in Suspense to satisfy Next.js 16 cacheComponents: the await
// on getCurrentTeamMember() (which calls supabase.auth.getClaims()) is
// uncached and would otherwise block route rendering.

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
  return <>{children}</>;
}
