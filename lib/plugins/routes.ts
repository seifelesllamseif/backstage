import type { PluginRouteMethod, PluginRoutes } from './types'

// Resolution for the two catch-all dispatchers (app/api/p/... and
// app/.well-known/...). Pure and server-agnostic so it is testable
// without a request lifecycle — the route files supply the routing table.

export function resolveRoute(
  routes: PluginRoutes | undefined,
  subpath: readonly string[],
  method: string
) {
  return routes?.[subpath.join('/')]?.[method as PluginRouteMethod]
}

// 404 covers "no such plugin", "plugin has no routes", "no such subpath"
// and "wrong method" alike: an uninstalled plugin must not be
// distinguishable from an unmounted path, or the dispatcher becomes an
// inventory of what a deployment has installed.
export function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
