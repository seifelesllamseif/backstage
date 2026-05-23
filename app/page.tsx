import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOGIN_ROUTE, DEFAULT_REDIRECT_ROUTE } from "@/routes";

// Root route: bounce based on session.
// The proxy already enforces this for /cockpit and /login round-trips; this
// page handles the bare `/` URL someone might land on directly.

export default async function RootPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? DEFAULT_REDIRECT_ROUTE : DEFAULT_LOGIN_ROUTE);
}
