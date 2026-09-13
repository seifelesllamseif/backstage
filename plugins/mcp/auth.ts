import 'server-only'

import { createClient } from '@supabase/supabase-js'

// Verification for MCP bearer tokens (Supabase OAuth 2.1 access tokens).
// The pure halves are split out so they are unit-testable without network,
// env, or a request lifecycle.

export type McpClaims = { sub: string; clientId: string }

// `client_id` is the load-bearing check. Supabase only mints that claim on
// tokens issued through the OAuth consent flow, so an ordinary browser
// session JWT — including one lifted from a stolen cookie — can never reach
// the MCP surface, even though it is signed by the same project.
export function validateOauthClaims(claims: unknown): McpClaims | null {
  if (!claims || typeof claims !== 'object') return null
  const c = claims as Record<string, unknown>
  if (typeof c.sub !== 'string' || c.sub.length === 0) return null
  if (typeof c.client_id !== 'string' || c.client_id.length === 0) return null
  return { sub: c.sub, clientId: c.client_id }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Shared by both path shapes below. Returning null (never a guess) is what
// keeps either endpoint from falling back to "whichever workspace was used
// last" — the ambiguity this segment exists to remove. The UUID check keeps
// unvalidated path input out of the query that follows it.
function extractCompanyId(pathname: string, pattern: RegExp): string | null {
  const id = pattern.exec(pathname)?.[1]
  if (!id) return null
  const decoded = decodeURIComponent(id)
  return UUID.test(decoded) ? decoded : null
}

function parsePathname(url: string): string | null {
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

// /api/p/mcp/w/<companyId> -> companyId, or null for any other shape.
export function parseCompanyId(url: string): string | null {
  const pathname = parsePathname(url)
  if (!pathname) return null
  return extractCompanyId(pathname, /^\/api\/p\/mcp\/w\/([^/]+)\/?$/)
}

// /.well-known/oauth-protected-resource/api/p/mcp/w/<companyId> ->
// companyId. RFC 9728 discovery documents live at a path formed by
// inserting the well-known segment before the protected resource's own
// path, since one shared /.well-known/oauth-protected-resource can't
// describe more than one resource — and every workspace here is a distinct
// resource with its own metadata document.
export function parseCompanyIdFromResourceMetadataPath(
  url: string
): string | null {
  const pathname = parsePathname(url)
  if (!pathname) return null
  return extractCompanyId(
    pathname,
    /^\/\.well-known\/oauth-protected-resource\/api\/p\/mcp\/w\/([^/]+)\/?$/
  )
}

// Stateless and reused across requests — verification runs on every MCP
// call. Built lazily so importing this module doesn't throw wherever env
// isn't loaded yet (tests, build-time analysis).
let client: ReturnType<typeof createClient> | undefined
const getClient = () =>
  (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  ))

// getClaims() verifies signature and expiry against the project's keys —
// locally via JWKS for asymmetric keys, or an auth-server round trip for
// HS256. That round trip is why docs/MCP.md recommends asymmetric signing.
export async function verifyMcpToken(token: string): Promise<McpClaims | null> {
  const { data, error } = await getClient().auth.getClaims(token)
  if (error) return null
  return validateOauthClaims(data?.claims)
}
