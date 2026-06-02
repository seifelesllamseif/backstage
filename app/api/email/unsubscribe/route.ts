import { NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

// One-click unsubscribe endpoint linked from every email footer. Accepts
// GET (mail clients prefetch links) and POST (RFC 8058 one-click). On a
// valid signature, flips every category off and shows a confirmation
// page. We don't sign the user in or expose anything member-specific
// beyond the success ack.

const RESULT_OK = `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font:14px system-ui;max-width:480px;margin:64px auto;padding:0 16px;color:#111;line-height:1.5}h1{font-size:18px;margin:0 0 12px}a{color:#0a7}p{margin:0 0 12px}</style>
</head><body>
<h1>You're unsubscribed</h1>
<p>You won't receive Backstage emails anymore. You can re-enable any category from Dashboard - Settings.</p>
<p><a href="/dashboard/settings">Open settings</a></p>
</body></html>`

const RESULT_BAD = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invalid link</title>
<style>body{font:14px system-ui;max-width:480px;margin:64px auto;padding:0 16px;color:#111;line-height:1.5}h1{font-size:18px;margin:0 0 12px}p{margin:0 0 12px}</style>
</head><body>
<h1>That link is invalid or expired</h1>
<p>If you want to stop emails, sign in and open Dashboard - Settings to manage them.</p>
</body></html>`

async function handle(memberId: string | null, token: string | null) {
  if (!memberId || !token) {
    return new NextResponse(RESULT_BAD, {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  }
  const ok = await verifyUnsubscribeToken(memberId, token)
  if (!ok) {
    return new NextResponse(RESULT_BAD, {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  }
  const supabase = createAdminClient()
  await supabase
    .from('notification_email_prefs')
    .upsert(
      {
        member_id: memberId,
        mentions: false,
        assigned: false,
        meetings: false,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'member_id' }
    )
  return new NextResponse(RESULT_OK, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  return handle(url.searchParams.get('m'), url.searchParams.get('t'))
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  return handle(url.searchParams.get('m'), url.searchParams.get('t'))
}
