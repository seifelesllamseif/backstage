import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import {
  DEFAULT_LOGIN_ROUTE,
  DEFAULT_REDIRECT_ROUTE,
  isAuthRoute,
  isProtectedRoute
} from '@/routes'

export async function proxy(request: NextRequest) {
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
