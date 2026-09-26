'use client'

import { pluginById } from '@/lib/plugins/registry'
import { pluginFeatureKey, type PluginPanelProps } from '@/lib/plugins/types'
import { useEnabledFeatures } from '@/lib/features/client'

// Mounts the panel of an installed + enabled plugin. The manifest wraps
// Panel in next/dynamic, so disabled plugins cost nothing in the shell
// chunk. Route-level requireFeature already 404s hard; this guard only
// covers the soft client-side window right after a disable.
export default function PluginHost({
  pluginId,
  member
}: {
  pluginId: string
  member: PluginPanelProps['member']
}) {
  const enabled = useEnabledFeatures()
  const plugin = pluginById(pluginId)

  if (!plugin || !enabled.has(pluginFeatureKey(pluginId))) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        This plugin is not available.
      </div>
    )
  }

  // The scroll container lives here, not in each plugin: <main> in the
  // shell is overflow-hidden, so a panel without one is simply unscrollable
  // past the fold. Doing it once means a plugin author cannot forget.
  return (
    <div className="h-full overflow-y-auto">
      <plugin.Panel member={member} />
    </div>
  )
}
