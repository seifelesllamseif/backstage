import "server-only";

import WebSocket from "ws";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Node 20 has no native WebSocket; @supabase/realtime-js throws without one.
// See docs/decisions/0010-auth-architecture.md.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
}

// Supabase client used inside the Next.js 16 proxy.ts file at the repo root.
// Refreshes the user's session by calling getClaims() once per navigation and
// passes refreshed cookies back to the browser via response.cookies.set.
//
// Returns the response (with refreshed cookies) AND the verified claims so the
// proxy can make routing decisions. Authorization checks ALSO happen in the
// (authenticated) route group's layout via the DAL — defense in depth. See
// decision 0010.

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
