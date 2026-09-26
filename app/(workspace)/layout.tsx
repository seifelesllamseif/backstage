import { Suspense } from 'react'
import { after } from 'next/server'
import { requireOnboardingComplete, touchLastSeen } from '@/lib/dal'
import { getWorkspaceBranding } from '@/lib/features/server'
import { FeaturesProvider } from '@/lib/features/client'
import DashboardSkeleton from './dashboard/_components/DashboardSkeleton'

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
// uncached and would otherwise block route rendering. The skeleton is the
// fallback HERE, at the boundary a cold page load actually waits on. It
// used to live in dashboard/loading.tsx, which also wrapped the (null)
// page segment, so every client navigation painted a second screenful of
// skeleton underneath the live shell while waiting on a round trip.

export default function WorkspaceLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Gated>{children}</Gated>
    </Suspense>
  )
}

async function Gated({ children }: { children: React.ReactNode }) {
  const member = await requireOnboardingComplete()
  const branding = await getWorkspaceBranding()
  after(() => touchLastSeen(member.id))
  return (
    <FeaturesProvider
      enabled={branding.enabledFeatures}
      logoUrl={branding.logoUrl}
      companyId={branding.companyId}
      companyName={branding.companyName}
      workspaces={branding.workspaces}
    >
      {children}
    </FeaturesProvider>
  )
}
