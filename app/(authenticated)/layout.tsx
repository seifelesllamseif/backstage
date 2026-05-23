import { verifySession } from "@/lib/dal";

// All routes inside the (authenticated) group are gated here. verifySession()
// redirects to /login if the JWT is missing or invalid. This is the real
// security gate; the proxy.ts redirect is a UX optimisation on top of it.
// See decision 0010.

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession();
  return <>{children}</>;
}
