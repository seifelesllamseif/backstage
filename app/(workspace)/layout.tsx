import { Suspense } from "react";
import { after } from "next/server";
import { requireOnboardingComplete, touchLastSeen } from "@/lib/dal";

// (workspace) — shell-less authenticated route group.
//
// Houses the routes that render the DashboardShell as their own chrome:
// /dashboard and /projects/[id] (which is a thin wrapper around the same
// DashboardShell with the project filter pre-pinned). See decision 0022.
//
// Identical security path to (authenticated)/layout.tsx — verifies the
// session — but does NOT wrap with <Shell>. The (authenticated)
// group is kept for /cockpit and /projects (list) which still use the
// shadcn sidebar; this group is for full-bleed surfaces.
//
// Decision 0029: also gates the workspace behind a completed onboarding
// (avatar_url IS NOT NULL). Members with a null avatar are redirected to
// /onboarding before they reach the app shell.
//
// next.config.ts has cacheComponents: true, so the auth gate runs inside
// a Suspense boundary - the await on supabase.auth.getClaims() is
// uncached and would otherwise block route rendering. Fallback is null
// because the child page's own Suspense (DashboardSkeleton) supplies the
// visible loading state.

export default function WorkspaceLayout({
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
  const member = await requireOnboardingComplete();
  // Defer the last_seen_at write so it doesn't sit in the render path. The
  // wizard's post-save redirect kept the React transition pending until the
  // dashboard rendered, which kept "Saving…" visible until the UPDATE
  // returned. after() runs it once the response is sent.
  after(() => touchLastSeen(member.id));
  return <>{children}</>;
}
