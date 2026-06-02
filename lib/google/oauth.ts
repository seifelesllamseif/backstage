import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/supabase/admin'

// Direct fetch against Google's OAuth + token endpoints. We deliberately
// don't pull in the `googleapis` SDK - the surface we need is tiny
// (authorize URL, code-for-tokens exchange, refresh) and a 500kB dep
// for it would be silly.

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  // userinfo.email so we can display "Connected as foo@gmail.com" in
  // Settings without needing another API call.
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ')

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

function clientCreds(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) return null
  return { id, secret }
}

export function googleConfigured(): boolean {
  return clientCreds() !== null
}

export function redirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (explicit) return explicit
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return `${base}/api/google/oauth/callback`
}

// ─── State token (CSRF + memberId carrier) ──────────────────────────────

// We sign the memberId starting the OAuth dance with a short-lived HMAC
// so the callback knows which user to attach tokens to. Same secret
// pattern as the email unsubscribe links (app_secrets.value).

const STATE_SECRET_KEY = 'google_oauth_state_secret'
const STATE_TTL_MS = 10 * 60 * 1000

let cachedSecret: string | null = null

async function loadStateSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_secrets')
    .select('value')
    .eq('key', STATE_SECRET_KEY)
    .maybeSingle()
  if (data?.value) {
    cachedSecret = data.value
    return cachedSecret
  }
  const generated = randomBytes(32).toString('hex')
  await supabase
    .from('app_secrets')
    .upsert({ key: STATE_SECRET_KEY, value: generated }, { onConflict: 'key' })
  cachedSecret = generated
  return generated
}

export async function buildState(memberId: string): Promise<string> {
  const secret = await loadStateSecret()
  const payload = `${memberId}.${Date.now()}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export async function verifyState(
  state: string
): Promise<{ memberId: string } | null> {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8')
    const [memberId, tsStr, sig] = raw.split('.')
    if (!memberId || !tsStr || !sig) return null
    const ts = Number(tsStr)
    if (Number.isNaN(ts) || Date.now() - ts > STATE_TTL_MS) return null
    const secret = await loadStateSecret()
    const expected = createHmac('sha256', secret)
      .update(`${memberId}.${tsStr}`)
      .digest('hex')
      .slice(0, 32)
    const a = Buffer.from(expected)
    const b = Buffer.from(sig)
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
    return { memberId }
  } catch {
    return null
  }
}

// ─── Authorize URL ───────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string): string | null {
  const creds = clientCreds()
  if (!creds) return null
  const params = new URLSearchParams({
    client_id: creds.id,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    // offline + consent ensures we always get a refresh_token, even on
    // a re-grant. Without these, Google may omit the refresh_token if
    // the user already approved the scopes before.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

// ─── Token exchange + refresh ────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
  email: string | null
} | { error: string }> {
  const creds = clientCreds()
  if (!creds) return { error: 'Google OAuth client not configured.' }
  const body = new URLSearchParams({
    code,
    client_id: creds.id,
    client_secret: creds.secret,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code'
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: `Token exchange failed: ${text.slice(0, 200)}` }
  }
  const data = (await res.json()) as GoogleTokenResponse
  if (!data.refresh_token) {
    return {
      error:
        'Google did not return a refresh token. Disconnect the app at myaccount.google.com/permissions and try again.'
    }
  }

  let email: string | null = null
  try {
    const u = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${data.access_token}` }
    })
    if (u.ok) {
      const json = (await u.json()) as { email?: string }
      email = json.email ?? null
    }
  } catch {
    /* best-effort */
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
    scope: data.scope,
    email
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<
  | { accessToken: string; expiresAt: Date; scope: string }
  | { error: string }
> {
  const creds = clientCreds()
  if (!creds) return { error: 'Google OAuth client not configured.' }
  const body = new URLSearchParams({
    client_id: creds.id,
    client_secret: creds.secret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: `Token refresh failed: ${text.slice(0, 200)}` }
  }
  const data = (await res.json()) as GoogleTokenResponse
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
    scope: data.scope
  }
}

// ─── Token store (one row per company, the scheduler) ────────────────────

export async function getSchedulerAccessToken(
  companyId: string
): Promise<{ accessToken: string; memberId: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at, member_id')
    .eq('company_id', companyId)
    .maybeSingle()
  if (!row) return { error: 'Google Calendar is not connected for this workspace.' }

  const expiresAt = new Date(row.expires_at).getTime()
  if (Date.now() < expiresAt) {
    return { accessToken: row.access_token, memberId: row.member_id }
  }

  const refreshed = await refreshAccessToken(row.refresh_token)
  if ('error' in refreshed) return { error: refreshed.error }

  await supabase
    .from('google_oauth_tokens')
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt.toISOString(),
      scope: refreshed.scope,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId)

  return { accessToken: refreshed.accessToken, memberId: row.member_id }
}

export async function markSchedulerUsed(companyId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('google_oauth_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('company_id', companyId)
}
