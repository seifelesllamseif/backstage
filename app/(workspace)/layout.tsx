import { verifySession } from "@/lib/dal";

// (workspace) — shell-less authenticated route group.
//
// Houses the routes that render the DashboardShell as their own chrome:
// /dashboard and /projects/[id] (which is a thin wrapper around the same
// DashboardShell with the project filter pre-pinned). See decision 0022.
//
// Identical security path to (authenticated)/layout.tsx — same
// verifySession() call — but does NOT wrap with <Shell>. The (authenticated)
// group is kept for /cockpit and /projects (list) which still use the
// shadcn sidebar; this group is for full-bleed surfaces.

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  return <>{children}</>;
}
