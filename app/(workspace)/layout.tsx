import { Suspense } from "react";
import { headers } from "next/headers";
import { requireOnboardingComplete } from "@/lib/dal";
import { publicSubpaths } from "@/routes";

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
  const pathname = (await headers()).get("x-pathname") ?? "";
  // Public subpaths (e.g. /dashboard/task/[ref] share view) skip the
  // onboarding + session gate so OG crawlers and unauthed recipients
  // can render the read-only summary. proxy.ts stamps x-pathname on
  // every request; an empty header is treated as gated (safe default).
  if (pathname && publicSubpaths.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  await requireOnboardingComplete();
  return <>{children}</>;
}
