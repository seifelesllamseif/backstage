import { verifySession } from "@/lib/dal";

// Shell-less authenticated layout — see decision 0021.
//
// Identical security path to (authenticated)/layout.tsx (same verifySession()
// call) but does NOT wrap with <Shell>. Routes in this group render full-
// bleed with no sidebar or top bar. /profile/[slug] is the only resident so
// far; future personal full-bleed surfaces land here too.

export default async function ProfileGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  return <>{children}</>;
}
