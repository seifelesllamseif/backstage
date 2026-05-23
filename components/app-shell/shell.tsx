import { getCurrentCrewMember } from "@/lib/dal";
import { Sidebar } from "./sidebar";

// Shell wraps every (authenticated) route. Server component — fetches the
// current crew_member and hands it to the (client) sidebar for the active
// nav state + the brand block.

export async function Shell({ children }: { children: React.ReactNode }) {
  const member = await getCurrentCrewMember();
  if (!member) {
    // verifySession() in the (authenticated) layout already redirected;
    // this should never actually render, but bail clearly if it does.
    throw new Error("No crew_member row for the current auth user.");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        member={{
          fullName: member.fullName,
          avatarInitials: member.avatarInitials,
          accessTier: member.accessTier,
        }}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
