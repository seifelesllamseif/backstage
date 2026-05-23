import "server-only";

import WebSocket from "ws";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Node 20 has no native WebSocket; @supabase/realtime-js throws without one.
// See docs/decisions/0010-auth-architecture.md.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
}

// Supabase client for server components and server actions.
// Reads cookies from next/headers; writes are best-effort (server components
// can't set cookies — the proxy handles refresh writes instead).

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component — cookies can only be set in
            // server actions, route handlers, or the proxy. Safe to ignore;
            // the proxy will write refreshed cookies on the next navigation.
          }
        },
      },
    },
  );
}
