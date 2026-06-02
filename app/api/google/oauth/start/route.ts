import { NextResponse } from 'next/server'
import { getCurrentTeamMember } from '@/lib/dal'
import {
  buildAuthorizeUrl,
  buildState,
  googleConfigured
} from '@/lib/google/oauth'

// Admin-only entry point. Generates the signed state token, redirects
// to Google's consent screen. The callback finishes the dance.

export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: 'Google OAuth client not configured on the server.' },
      { status: 500 }
    )
  }
  const member = await getCurrentTeamMember()
  if (!member) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }
  if (member.accessTier !== 'admin') {
    return NextResponse.json(
      { error: 'Only an admin can connect the workspace calendar.' },
      { status: 403 }
    )
  }

  const state = await buildState(member.id)
  const url = buildAuthorizeUrl(state)
  if (!url) {
    return NextResponse.json(
      { error: 'Google OAuth client not configured on the server.' },
      { status: 500 }
    )
  }
  return NextResponse.redirect(url, 302)
}
