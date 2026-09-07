import dynamic from 'next/dynamic'
import { Plug } from 'lucide-react'

import type { PluginManifest } from '@/lib/plugins/types'

const mcp: PluginManifest = {
  id: 'mcp',
  name: 'AI Assistant (MCP)',
  description: 'Let Claude, Cursor, or any MCP client work in this workspace.',
  longDescription:
    'Exposes this workspace over the Model Context Protocol. Each member ' +
    'connects their own assistant and authenticates as themselves through ' +
    'OAuth, so an assistant can never do more than the member could in the ' +
    'UI. An admin enables the plugin and configures the Supabase OAuth ' +
    'server once; after that the whole team can connect. See docs/MCP.md.',
  version: '0.1.0',
  author: 'Backstage',
  group: 'Advanced',
  icon: Plug,
  // No minTier: every member connects their own client. Setup stays
  // admin-only through the marketplace's existing enable gate.
  nav: { label: 'AI Assistant', hint: 'Connect Claude or Cursor' },
  Panel: dynamic(() => import('./Panel'))
}

export default mcp
