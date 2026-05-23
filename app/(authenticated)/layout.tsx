import { verifySession } from "@/lib/dal";
import { Shell } from "@/components/app-shell/shell";

// Every route inside the (authenticated) group renders inside Shell —
// the persistent sidebar + content layout. verifySession() runs first as
// the security gate (decision 0010); Shell then fetches the crew_member
// once and feeds it to the sidebar.

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  return <Shell>{children}</Shell>;
}
