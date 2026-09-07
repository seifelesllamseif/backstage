import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

// Records the user's decision on an OAuth authorization request, then sends
// them back to the client with either a code or an access_denied error.
//
// CSRF: approve/deny act on the caller's Supabase session, whose cookie is
// SameSite=Lax, so a cross-site form POST arrives without it and fails at
// Supabase rather than silently approving. A hidden token here would add
// nothing on top of that.
export async function POST(request: Request) {
  const form = await request.formData()
  const authorizationId = form.get('authorization_id')
  const decision = form.get('decision')

  if (typeof authorizationId !== 'string' || !authorizationId) {
    return NextResponse.json(
      { error: 'Missing authorization_id' },
      { status: 400 }
    )
  }
  if (decision !== 'approve' && decision !== 'deny') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const supabase = await createClient()

  // skipBrowserRedirect: this runs on the server, so take the URL back and
  // issue the redirect ourselves. 303 turns the POST into a GET, otherwise
  // the browser would re-POST to the OAuth client.
  const { data, error } =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true
        })

  if (error || !data?.redirect_url) {
    return NextResponse.json(
      { error: error?.message ?? 'Authorization failed' },
      { status: 400 }
    )
  }

  return NextResponse.redirect(data.redirect_url, 303)
}
