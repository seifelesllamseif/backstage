import { DashboardChrome } from './_components/DashboardChrome'
import { QueryProvider } from './_components/QueryProvider'

// Mounts the dashboard chrome (sidebar + topbar + modals) ONCE at the
// route-segment layout level. It persists across every navigation under
// /dashboard/* so tab clicks no longer unmount the shell - only the URL
// pathname changes, and DashboardShell reads it to switch panels in place.
//
// Pages under /dashboard/* return null on purpose. They exist only so
// Next.js sees the route segments and so generateMetadata can run with the
// real searchParams. The actual UI lives in <DashboardChrome /> below.

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <DashboardChrome />
      {children}
    </QueryProvider>
  )
}
