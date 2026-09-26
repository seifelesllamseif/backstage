import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { panelMetadata } from '../../_components/panelMetadata'
import { requireFeature } from '@/lib/features/server'
import { PLUGIN_IDS, pluginById } from '@/lib/plugins/registry'
import { pluginFeatureKey } from '@/lib/plugins/types'

type Params = Promise<{ pluginId: string }>

// The plugin set is a build-time registry, so enumerate it: params are
// known ahead of time, which keeps this route prerendered (and therefore
// prefetchable) instead of dynamic.
export function generateStaticParams() {
  return PLUGIN_IDS.map((pluginId) => ({ pluginId }))
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { pluginId } = await params
  return panelMetadata(pluginById(pluginId)?.name ?? 'Plugin')
}

// URL target only — the chrome in the layout reads usePathname() and
// mounts <PluginHost/> for this plugin id (same pattern as every panel).
export default function PluginPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({ params }: { params: Params }) {
  const { pluginId } = await params
  if (!PLUGIN_IDS.includes(pluginId)) notFound()
  await requireFeature(pluginFeatureKey(pluginId))
  return null
}
