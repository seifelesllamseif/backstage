import 'server-only'

import { Resend } from 'resend'
import { createAdminClient } from '@/supabase/admin'

// Transactional email pipe for the dashboard (mentions, assignments,
// meeting lifecycle). Auth emails stay on Supabase. We send via Resend
// here so app-level notifications get a separate sender, separate
// rate limits, and a separate domain reputation.
//
// Dev safety: when RESEND_API_KEY is missing the wrapper logs and no-ops
// instead of crashing, so contributors can run the app without a key.

const FROM_DEFAULT = 'Backstage <noreply@verbivore.app>'
const REPLY_TO_DEFAULT = 'noreply@verbivore.app'

let cached: Resend | null = null

function client(): Resend | null {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cached = new Resend(key)
  return cached
}

export type EmailPrefKey = 'mentions' | 'assigned' | 'meetings'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
  // Per-member opt-out gate. When omitted the email skips the prefs
  // lookup (use for system mail, never for trigger-based mail).
  prefCheck?: { memberId: string; key: EmailPrefKey }
  // Optional one-click List-Unsubscribe header value (URL).
  unsubscribeUrl?: string
  // Tag used by Resend for analytics. Defaults to the pref key when set.
  tag?: string
}

export interface SendEmailResult {
  ok: boolean
  reason?: 'no_key' | 'opted_out' | 'send_failed'
  id?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = client()
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[email] RESEND_API_KEY missing; would have sent "${input.subject}" to ${input.to}`
      )
    }
    return { ok: false, reason: 'no_key' }
  }

  if (input.prefCheck) {
    const allowed = await checkEmailPref(input.prefCheck.memberId, input.prefCheck.key)
    if (!allowed) return { ok: false, reason: 'opted_out' }
  }

  const headers: Record<string, string> = {}
  if (input.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${input.unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_DEFAULT,
      replyTo: REPLY_TO_DEFAULT,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers,
      tags: input.tag ? [{ name: 'category', value: input.tag }] : undefined
    })
    if (error) {
      console.error('[email] send_failed', error)
      return { ok: false, reason: 'send_failed' }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[email] send_threw', err)
    return { ok: false, reason: 'send_failed' }
  }
}

// True when the member has the given category opted in. Missing rows
// (rare; trigger backfills on insert) default to opted-in so we don't
// silently drop the first email to a brand-new member.
export async function checkEmailPref(
  memberId: string,
  key: EmailPrefKey
): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notification_email_prefs')
    .select(key)
    .eq('member_id', memberId)
    .maybeSingle()
  if (!data) return true
  const value = (data as Record<string, boolean | null>)[key]
  return value !== false
}

// Turns an in-app path (`/share/ABC-1`) into a full URL suitable for an
// email body. NEXT_PUBLIC_SITE_URL is the canonical base; localhost is
// the dev fallback.
export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

// Resolves the address we should send to for a given member: contact_email
// takes priority (the address they chose), email (auth/login) is the
// fallback. Returns null when both are missing.
export async function resolveMemberEmail(memberId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('contact_email, email')
    .eq('id', memberId)
    .maybeSingle()
  if (!data) return null
  return (data.contact_email && data.contact_email.trim()) || data.email || null
}
