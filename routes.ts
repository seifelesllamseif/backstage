/**
 * An array of routes that are public:
 * These routes do not require authentication
 * @type {string[]}
 */
export const publicRoutes: string[] = ['/']

/**
 * An array of routes that are used for authentication:
 * The routes will be used to check if the user is authenticated
 * @type {string[]}
 */
export const authRoutes: string[] = ['/login']

/**
 * An array of routes that are used for protectedRoutes:
 * These routes will be hidden till the user is authenticated
 * @type {string[]}
 */
export const protectedRoutes: string[] = [
  '/dashboard',
  '/cockpit',
  '/projects',
  '/profile',
  '/onboarding'
]

/**
 * The base route of the API application:
 * Routes with this prefix are used for application APIs
 * @type {string}
 */
export const apiAuthRoutes: string = '/api'

/**
 * The default login route
 * @type {string}
 */
export const DEFAULT_LOGIN_ROUTE: string = '/login'

/**
 * The default redirect route after a successful login
 * @type {string}
 */
export const DEFAULT_REDIRECT_ROUTE: string = '/dashboard'

/**
 * Onboarding wizard route. New accounts (avatar_url IS NULL) are funneled
 * here before reaching the app. See docs/decisions/0029-onboarding-flow.md.
 * @type {string}
 */
export const ONBOARDING_ROUTE: string = '/onboarding'

// TODO (multi-tenant, post-slice-1): when Backstage adds a second tenant,
// this file is also the place for MAIN_DOMAIN_SUBDOMAINS, PRODUCTION_DOMAINS,
// and the getSubdomain helper. Single-tenant for now per slice-1 plan §3.

// --------- helpers --------------------------------------------------------

/**
 * Returns true if `pathname` exactly matches or is nested under any entry in
 * the `protectedRoutes` array. Used by proxy.ts to redirect unauthed visitors
 * and by the (authenticated) layout as defense-in-depth.
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Returns true if `pathname` is the dedicated login (or any future auth)
 * route. Used by proxy.ts to redirect already-authed visitors away.
 */
export function isAuthRoute(pathname: string): boolean {
  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Returns true if `pathname` is in the public allowlist. Currently unused by
 * the proxy (which only acts on protected/auth routes) but exported so callers
 * can ask the registry rather than hardcode paths elsewhere.
 */
export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Validate a `?redirect=` target before redirecting to it after a successful
 * login. Blocks open-redirect attacks like `?redirect=//evil.com` or
 * `?redirect=https://evil.com` by requiring a single-slash internal path.
 */
export function safeInternalRedirect(
  target: string | null | undefined
): string {
  if (!target) return DEFAULT_REDIRECT_ROUTE
  if (!target.startsWith('/') || target.startsWith('//')) {
    return DEFAULT_REDIRECT_ROUTE
  }
  return target
}
