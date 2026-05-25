import { getCurrentCrewMember } from '@/lib/dal'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { AppSidebar } from './sidebar'

// Shell wraps every route in the (authenticated) group. Server component —
// fetches the current crew_member once and hands it to the AppSidebar.
//
// Uses shadcn's SidebarProvider + SidebarInset pattern (decision 0017,
// rev. for shadcn-sidebar adoption). cmd+B / ctrl+B toggles. Sidebar
// collapses to icons on desktop and to a Sheet on mobile.
//
// After decision 0022, /dashboard and /projects/[id] moved out of the
// (authenticated) group into (workspace) — they render the DashboardShell
// as their own chrome and would double-render the sidebar if wrapped here.
// This Shell still wraps /cockpit and /projects (list).

export async function Shell({ children }: { children: React.ReactNode }) {
  const member = await getCurrentCrewMember()
  if (!member) {
    throw new Error('No crew_member row for the current auth user.')
  }

  return (
    <SidebarProvider>
      <AppSidebar
        member={{
          fullName: member.fullName,
          avatarInitials: member.avatarInitials,
          accessTier: member.accessTier
        }}
      />
      <SidebarInset>
        <header className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
