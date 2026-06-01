import 'server-only'

import webpush from 'web-push'
import { createAdminClient } from '@/supabase/admin'

// Wraps web-push for the dashboard's notification feature.
//
// VAPID keypair lives in the public.app_secrets table so we don't depend on
// env vars (and the team can rotate without touching deploys). On cold
// start we read the three keys (public, private, subject). If they're
// missing we generate, insert, and keep the module-level cache warm for
// the rest of the process.

let cached: {
  publicKey: string
  privateKey: string
  subject: string
} | null = null

const SUBJECT_DEFAULT = 'mailto:notifications@verbivore.app'

async function loadVapid(): Promise<typeof cached> {
  if (cached) return cached
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_secrets')
    .select('key, value')
    .in('key', ['vapid_public', 'vapid_private', 'vapid_subject'])
  const map = new Map((data ?? []).map((r) => [r.key, r.value]))
  let publicKey = map.get('vapid_public') ?? null
  let privateKey = map.get('vapid_private') ?? null
  let subject = map.get('vapid_subject') ?? null

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys()
    publicKey = generated.publicKey
    privateKey = generated.privateKey
    subject ??= SUBJECT_DEFAULT
    await supabase
      .from('app_secrets')
      .upsert(
        [
          { key: 'vapid_public', value: publicKey },
          { key: 'vapid_private', value: privateKey },
          { key: 'vapid_subject', value: subject }
        ],
        { onConflict: 'key' }
      )
  }
  if (!subject) subject = SUBJECT_DEFAULT
  webpush.setVapidDetails(subject, publicKey, privateKey)
  cached = { publicKey, privateKey, subject }
  return cached
}

// Public-key surface for the client subscription flow. Safe to expose; the
// private key never leaves this module.
export async function getVapidPublicKey(): Promise<string> {
  const v = await loadVapid()
  if (!v) throw new Error('VAPID keys unavailable')
  return v.publicKey
}

export interface PushPayload {
  title: string
  body: string
  // Absolute or root-relative URL the notification click should open. The
  // service worker focuses an existing tab on that URL or opens a new one.
  url: string
  // Per-task tag so two pings about the same task collapse into one in
  // the OS notification tray. Optional - omit for ad-hoc pushes.
  tag?: string
}

// Sends `payload` to every device subscription registered against
// `memberId`. Subscriptions that come back 404 or 410 (the W3C-defined
// "gone" responses) get pruned so the table doesn't grow unbounded.
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number; failed: number }> {
  await loadVapid()
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('member_id', memberId)
  if (!subs || subs.length === 0) {
    return { sent: 0, pruned: 0, failed: 0 }
  }
  const json = JSON.stringify(payload)
  const goneEndpoints: string[] = []
  let sent = 0
  let failed = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          json
        )
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          goneEndpoints.push(sub.endpoint)
        } else {
          failed += 1
        }
      }
    })
  )
  if (goneEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', goneEndpoints)
  }
  // Best-effort timestamp; ignore failure.
  void supabase
    .from('push_subscriptions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('member_id', memberId)
  return { sent, pruned: goneEndpoints.length, failed }
}
