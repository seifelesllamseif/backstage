import 'server-only'

import { PLUGIN_SERVERS } from '@/plugins.config.server'
import { notFound, resolveRoute } from '@/lib/plugins/routes'

// Catch-all for plugin-owned /.well-known paths. Separate from
// /api/p/<id> because discovery documents are specified at fixed
// root-relative locations (RFC 9728), so they cannot be namespaced by
// plugin id. Iteration order is plugins.config.server.ts order and the
// first claim wins — see the `wellKnown` note in lib/plugins/types.ts.
async function handle(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params
  for (const mod of Object.values(PLUGIN_SERVERS)) {
    const handler = resolveRoute(mod.wellKnown, path, request.method)
    if (handler) return handler(request)
  }
  return notFound()
}

export { handle as GET, handle as OPTIONS }
