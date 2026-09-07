// Installed plugins — the client-safe half. To install a plugin, import
// its manifest here AND its server module in plugins.config.server.ts,
// then redeploy. Keep this file free of server imports: it is bundled
// into the browser.
import type { PluginManifest } from '@/lib/plugins/types'
import mcp from '@/plugins/mcp/manifest'
import polls from '@/plugins/polls/manifest'

export const PLUGINS: readonly PluginManifest[] = [polls, mcp]
