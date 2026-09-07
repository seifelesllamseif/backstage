'use server'

import { z } from 'zod'
import { requireAccessTier } from '@/lib/dal'
import {
  INSTALL_TOKEN_KEY,
  getInstallRepo,
  getInstallTarget,
  getInstallToken,
  installPluginToRepo
} from '@/lib/install/github'
import { createAdminClient } from '@/supabase/admin'
import { getMarketplaceCatalog } from './marketplace-actions'

// One-click install: commit the plugin into this deployment's repo and let
// the platform rebuild. Plugins compile at build time (PLUGINS.md), so a
// commit is the install — there is nothing to load at runtime.

export async function canInstallPlugins(): Promise<boolean> {
  return (await getInstallTarget()) !== null
}

export type InstallStatus = {
  // Derived from VERCEL_GIT_* — null only on a self-host that builds
  // somewhere Vercel's git vars don't reach.
  repo: string | null
  connected: boolean
  // Env-provided tokens can't be cleared from the UI; say so rather than
  // showing a Disconnect button that silently does nothing.
  managedByEnv: boolean
}

export async function getInstallStatus(): Promise<InstallStatus> {
  await requireAccessTier(['admin'])
  const repo = getInstallRepo()
  return {
    repo: repo ? `${repo.owner}/${repo.repo}` : null,
    connected: (await getInstallToken()) !== null,
    managedByEnv: Boolean(process.env.GITHUB_INSTALL_TOKEN)
  }
}

export async function setInstallToken(
  token: string
): Promise<{ ok: true } | { error: string }> {
  await requireAccessTier(['admin'])
  const trimmed = token.trim()
  if (!trimmed) return { error: 'Token is required.' }

  const repo = getInstallRepo()
  if (!repo) return { error: "Could not determine this deployment's repo." }

  // Verify before storing: a token that cannot write is worse than none,
  // because the failure would otherwise surface at install time.
  const res = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}`,
    {
      cache: 'no-store',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${trimmed}`
      }
    }
  )
  if (!res.ok) {
    return { error: `GitHub rejected that token (${res.status}).` }
  }
  const repoInfo = (await res.json()) as { permissions?: { push?: boolean } }
  if (!repoInfo.permissions?.push) {
    return {
      error:
        'That token cannot write to this repo. Grant Contents: read and write.'
    }
  }

  await createAdminClient()
    .from('app_secrets')
    .upsert({ key: INSTALL_TOKEN_KEY, value: trimmed }, { onConflict: 'key' })
  return { ok: true }
}

export async function clearInstallToken(): Promise<{ ok: true }> {
  await requireAccessTier(['admin'])
  await createAdminClient()
    .from('app_secrets')
    .delete()
    .eq('key', INSTALL_TOKEN_KEY)
  return { ok: true }
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

  const target = await getInstallTarget()
  if (!target) {
    return {
      error:
        'Connect GitHub in Settings first so installs have somewhere to commit.'
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
