import { NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import { exchangeCodeForTokens, verifyState } from '@/lib/google/oauth'

// Handler for the redirect_uri registered with Google. Verifies the
// state token, exchanges the auth code for tokens, upserts the row.
// On success we redirect back into Settings; on error we still go
// back to Settings but with ?google=error so the UI can surface it.

function back(qs: string): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return NextResponse.redirect(
    `${base}/dashboard/settings?${qs}`,
    302
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const googleError = url.searchParams.get('error')

  if (googleError) {
    return back(`google=${encodeURIComponent(googleError)}`)
  }
  if (!code || !state) {
    return back('google=missing_params')
  }

  const member = await getCurrentTeamMember()
  if (!member) {
    return back('google=not_signed_in')
  }
  if (member.accessTier !== 'admin') {
    return back('google=admin_only')
  }

  const verified = await verifyState(state)
  if (!verified) {
    return back('google=bad_state')
  }
  if (verified.memberId !== member.id) {
    // Token was minted for a different signed-in user. Reject to keep
    // tokens from getting attached to the wrong account.
    return back('google=state_mismatch')
  }

  const tokens = await exchangeCodeForTokens(code)
  if ('error' in tokens) {
    return back(`google=${encodeURIComponent(tokens.error.slice(0, 80))}`)
  }

  const supabase = createAdminClient()
  await supabase
    .from('google_oauth_tokens')
    .upsert(
      {
        company_id: member.companyId,
        member_id: member.id,
        google_email: tokens.email,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
        expires_at: tokens.expiresAt.toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'company_id' }
    )

  return back('google=connected')
}
