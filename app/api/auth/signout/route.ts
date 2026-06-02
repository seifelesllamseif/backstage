import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { DEFAULT_LOGIN_ROUTE } from '@/routes'

// Forced sign-out endpoint. The workspace layout redirects here when
// it detects a 'left' member - server components can't write cookies
// (see supabase/server.ts setAll callback), so an inline signOut from
// the layout silently fails and the proxy keeps seeing the session as
// valid. Doing it from a route handler lets us actually clear the
// auth cookies before the redirect, breaking the refresh loop.

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL(DEFAULT_LOGIN_ROUTE, request.url)
  const reason = new URL(request.url).searchParams.get('reason')
  if (reason) url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}
