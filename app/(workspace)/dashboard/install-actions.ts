'use server'

import { z } from 'zod'
import { requireAccessTier } from '@/lib/dal'
import { getInstallTarget, installPluginToRepo } from '@/lib/install/github'
import { getMarketplaceCatalog } from './marketplace-actions'

// One-click install: commit the plugin into this deployment's repo and let
// the platform rebuild. Plugins compile at build time (PLUGINS.md), so a
// commit is the install — there is nothing to load at runtime.

export async function canInstallPlugins(): Promise<boolean> {
  return getInstallTarget() !== null
}

export async function installPlugin(
  pluginId: string
): Promise<{ ok: true; commitUrl: string } | { error: string }> {
  // Admin-only, same gate as enabling a feature.
  await requireAccessTier(['admin'])

  const parsed = z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,30}$/)
    .safeParse(pluginId)
  if (!parsed.success) return { error: 'Invalid plugin id.' }

  const target = getInstallTarget()
  if (!target) {
    return {
      error:
        'One-click install is not configured. Set GITHUB_INSTALL_REPO and GITHUB_INSTALL_TOKEN.'
    }
  }

  // The client sends only an id. Resolving repoUrl from the catalog here is
  // what stops a caller from pointing the installer at a repo of their
  // choosing — the source is always one the registry vouched for.
  const entry = (await getMarketplaceCatalog()).find(
    (p) => p.id === parsed.data
  )
  if (!entry) return { error: 'Plugin not found in the catalog.' }

  try {
    const commitUrl = await installPluginToRepo(target, entry.id, entry.repoUrl)
    return { ok: true, commitUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Install failed.' }
  }
}
