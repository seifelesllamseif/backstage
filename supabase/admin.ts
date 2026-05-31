import "server-only";

import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client. Bypasses RLS — only use server-side, never expose to
// the browser. Used for paths where the user-scoped session client can't
// reach (e.g., the avatars Storage upload, which fails RLS because the
// SSR-cookie session isn't propagated to the storage HTTP request).
//
// Safety: callers must verify the user's identity via getCurrentTeamMember()
// first and constrain all writes to that user's own scope (their team_members
// row, their own storage folder, etc.).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
}

export function createAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "createAdminClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
