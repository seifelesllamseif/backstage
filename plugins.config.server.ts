// Installed plugins — the server half. Maps plugin id to its server
// module (action handlers). Mirror every entry in plugins.config.ts.
// The server-only import makes any accidental client-side import a loud
// build failure instead of a silent secrets leak.
import 'server-only'

import type { PluginServerModule } from '@/lib/plugins/types'
import mcpServer from '@/plugins/mcp/server'
import pollsServer from '@/plugins/polls/server'

export const PLUGIN_SERVERS: Record<string, PluginServerModule> = {
  polls: pollsServer,
  mcp: mcpServer
}
