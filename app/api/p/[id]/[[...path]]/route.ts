import 'server-only'

import { PLUGIN_SERVERS } from '@/plugins.config.server'
import { notFound, resolveRoute } from '@/lib/plugins/routes'

// Catch-all mount for plugin HTTP routes: /api/p/<plugin-id>/<subpath>.
// Plugins declare `routes` in their server module (see PLUGINS.md); this
// file is the only thing that knows how to reach them, so adding a route
// never touches app/.
//
// Auth is the handler's job. Nothing here checks a session: these paths
// are absent from `protectedRoutes`, so proxy.ts lets them through for
// exactly the protocol clients (MCP, webhooks) that carry their own
// credentials instead of a cookie.
async function handle(
  request: Request,
  ctx: { params: Promise<{ id: string; path?: string[] }> }
) {
  const { id, path = [] } = await ctx.params
  const handler = resolveRoute(PLUGIN_SERVERS[id]?.routes, path, request.method)
  return handler ? handler(request) : notFound()
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS
}
