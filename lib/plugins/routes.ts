import type { PluginRouteMethod, PluginRoutes } from './types'

// Resolution for the two catch-all dispatchers (app/api/p/... and
// app/.well-known/...). Pure and server-agnostic so it is testable
// without a request lifecycle — the route files supply the routing table.

export function resolveRoute(
  routes: PluginRoutes | undefined,
  subpath: readonly string[],
  method: string
) {
  if (!routes) return undefined
  const m = method as PluginRouteMethod

  const exact = routes[subpath.join('/')]?.[m]
  if (exact) return exact

  // Wildcard fallback: a key ending in '*' matches any remainder, so
  // 'w/*' serves /w/<companyId>. Longest prefix wins, so a concrete key
  // always beats a wildcard. Handlers receive the raw Request and read
  // the concrete segment off request.url — there is no params object at
  // this boundary to thread one through.
  for (let i = subpath.length - 1; i >= 0; i--) {
    const handler = routes[[...subpath.slice(0, i), '*'].join('/')]?.[m]
    if (handler) return handler
  }
  return undefined
}

// 404 covers "no such plugin", "plugin has no routes", "no such subpath"
// and "wrong method" alike: an uninstalled plugin must not be
// distinguishable from an unmounted path, or the dispatcher becomes an
// inventory of what a deployment has installed.
export function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
