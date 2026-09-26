import { Suspense } from 'react'
import { getCurrentTeamMember } from '@/lib/dal'
import { getUpdateStatus } from '@/lib/updates'
import { DashboardChrome } from './_components/DashboardChrome'
import { DashboardTour } from './_components/DashboardTour'
import { QueryProvider } from './_components/QueryProvider'
import { ServiceWorkerRegistrar } from './_components/ServiceWorkerRegistrar'
import { UpdateNotice } from './_components/UpdateNotice'

// Mounts the dashboard chrome (sidebar + topbar + modals) ONCE at the
// route-segment layout level. It persists across every navigation under
// /dashboard/* so tab clicks no longer unmount the shell - only the URL
// pathname changes, and DashboardShell reads it to switch panels in place.
//
// Pages under /dashboard/* return null on purpose. They exist only so
// Next.js sees the route segments; the actual UI lives in <DashboardChrome />
// below.

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <ServiceWorkerRegistrar />
      <DashboardChrome />
      <DashboardTour />
      <Suspense fallback={null}>
        <AdminUpdateNotice />
      </Suspense>
      {children}
    </QueryProvider>
  )
}

// Only admins can act on it (updating means merging a PR in the deployment's
// own repo), so only admins see it.
async function AdminUpdateNotice() {
  const member = await getCurrentTeamMember()
  if (member?.accessTier !== 'admin') return null
  const status = await getUpdateStatus()
  return status ? <UpdateNotice status={status} /> : null
}
