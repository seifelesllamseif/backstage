import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/supabase/admin'

// One-click unsubscribe links in email footers carry a signed token so
// the user can opt out without logging in. We HMAC the member id with
// a workspace-wide secret stored in app_secrets (same pattern as VAPID
// keys in lib/push.ts). The token is stateless: verify regenerates
// HMAC and compares constant-time.

const SECRET_KEY = 'email_unsubscribe_secret'

let cachedSecret: string | null = null

async function loadSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_secrets')
    .select('value')
    .eq('key', SECRET_KEY)
    .maybeSingle()
  if (data?.value) {
    cachedSecret = data.value
    return cachedSecret
  }
  const generated = randomBytes(32).toString('hex')
  await supabase
    .from('app_secrets')
    .upsert({ key: SECRET_KEY, value: generated }, { onConflict: 'key' })
  cachedSecret = generated
  return generated
}

function sign(memberId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(memberId)
    .digest('hex')
    .slice(0, 32)
}

// Returns the value to pass into sendEmail({ unsubscribeUrl }). The link
// is absolute because email clients won't resolve relative URLs.
export async function buildUnsubscribeUrl(memberId: string): Promise<string> {
  const secret = await loadSecret()
  const sig = sign(memberId, secret)
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return `${base}/api/email/unsubscribe?m=${encodeURIComponent(memberId)}&t=${sig}`
}

export async function verifyUnsubscribeToken(
  memberId: string,
  token: string
): Promise<boolean> {
  if (!memberId || !token) return false
  const secret = await loadSecret()
  const expected = sign(memberId, secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
