import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/supabase/proxy'
import {
  DEFAULT_LOGIN_ROUTE,
  DEFAULT_REDIRECT_ROUTE,
  isAuthRoute,
  isProtectedRoute
} from '@/routes'

export async function proxy(request: NextRequest) {
  // Stamp the request pathname onto a custom header so RSC layouts can
  // read it via headers() (Next.js exposes no built-in pathname in
  // server contexts). The (workspace) layout uses this to short-circuit
  // its auth gate for paths in publicSubpaths.
  request.headers.set('x-pathname', request.nextUrl.pathname)

  const { response, claims } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const authed = claims !== null

  if (isProtectedRoute(pathname) && !authed) {
    const url = request.nextUrl.clone()
    url.pathname = DEFAULT_LOGIN_ROUTE
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute(pathname) && authed) {
    const url = request.nextUrl.clone()
    url.pathname = DEFAULT_REDIRECT_ROUTE
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ]
}
