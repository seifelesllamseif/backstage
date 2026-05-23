import { getCurrentCrewMember } from "@/lib/dal";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";

// Shell wraps every (authenticated) route. Server component — fetches the
// current crew_member once and hands it to the AppSidebar.
//
// Uses shadcn's SidebarProvider + SidebarInset pattern (decision 0017,
// rev. for shadcn-sidebar adoption). cmd+B / ctrl+B toggles. Sidebar
// collapses to icons on desktop and to a Sheet on mobile.

export async function Shell({ children }: { children: React.ReactNode }) {
  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }

  return (
    <SidebarProvider>
      <AppSidebar
        member={{
          fullName: member.fullName,
          avatarInitials: member.avatarInitials,
          accessTier: member.accessTier,
        }}
      />
      <SidebarInset>
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <SidebarTrigger />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
