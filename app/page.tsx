import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { DEFAULT_LOGIN_ROUTE, DEFAULT_REDIRECT_ROUTE } from "@/routes";

// Root route: bounce based on session.
// The proxy already enforces this for /cockpit and /login round-trips; this
// page handles the bare `/` URL someone might land on directly.

export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}

async function Redirector(): Promise<never> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? DEFAULT_REDIRECT_ROUTE : DEFAULT_LOGIN_ROUTE);
}
