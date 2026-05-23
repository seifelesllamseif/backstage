"use client";

import { createBrowserClient } from "@supabase/ssr";

// Supabase client for "use client" components.
// Browser has native WebSocket — no realtime polyfill needed here.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
