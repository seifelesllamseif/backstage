'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck, Download, ExternalLink, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { PLUGINS } from '@/plugins.config'
import { pluginFeatureKey } from '@/lib/plugins/types'
import { useEnabledFeatures } from '@/lib/features/client'
import { FEATURES, ALL_FEATURE_KEYS } from '@/lib/features/keys'
import { setFeatureEnabled } from '../features-actions'
import {
  getMarketplaceCatalog,
  requestPlugin,
  type MarketplaceCatalogEntry
} from '../marketplace-actions'
import { canInstallPlugins, installPlugin } from '../install-actions'

type EntryState = 'enabled' | 'installed' | 'not-installed'

type Entry = {
  id: string
  kind: 'core' | 'plugin'
  // The enabled_features key this entry toggles.
  featureKey: string
  name: string
  description: string
  longDescription?: string
  version?: string
  author?: string
  group: string
  repoUrl?: string
  iconUrl?: string
  state: EntryState
}

export default function MarketplacePanel({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const enabled = useEnabledFeatures()
  const [selected, setSelected] = useState<Entry | null>(null)

  const { data: catalog } = useQuery({
    queryKey: ['marketplaceCatalog'],
    queryFn: () => getMarketplaceCatalog(),
    staleTime: 60 * 60 * 1000
  })

  // Whether this deployment has a repo + token to commit into. Static per
  // deployment, so it never needs refetching.
  const { data: canInstall = false } = useQuery({
    queryKey: ['canInstallPlugins'],
    queryFn: () => canInstallPlugins(),
    staleTime: Infinity
  })

  const entries = useMemo<Entry[]>(() => {
    const installedById = new Map(PLUGINS.map((p) => [p.id, p]))
    const stateFor = (id: string): EntryState =>
      enabled.has(pluginFeatureKey(id))
        ? 'enabled'
        : installedById.has(id)
          ? 'installed'
          : 'not-installed'

    // Built-in modules share the surface: same groups, same toggle.
    const core: Entry[] = ALL_FEATURE_KEYS.map((key) => ({
      id: key,
      kind: 'core' as const,
      featureKey: key,
      name: FEATURES[key].label,
      description: FEATURES[key].description,
      group: FEATURES[key].group,
      state: enabled.has(key) ? ('enabled' as const) : ('installed' as const)
    }))

    const fromCatalog: Entry[] = (catalog ?? []).map(
      (c: MarketplaceCatalogEntry) => {
        const local = installedById.get(c.id)
        return {
          id: c.id,
          kind: 'plugin' as const,
          featureKey: pluginFeatureKey(c.id),
          name: local?.name ?? c.name,
          description: local?.description ?? c.description,
          longDescription: local?.longDescription,
          version: local?.version ?? c.version,
          author: local?.author ?? c.author,
          group: local?.group ?? c.group,
          repoUrl: c.repoUrl,
          iconUrl: c.iconUrl,
          state: stateFor(c.id)
        }
      }
    )
    // Local/private plugins that aren't published in the catalog.
    const catalogIds = new Set(fromCatalog.map((e) => e.id))
    const localOnly: Entry[] = PLUGINS.filter((p) => !catalogIds.has(p.id)).map(
      (p) => ({
        id: p.id,
        kind: 'plugin' as const,
        featureKey: pluginFeatureKey(p.id),
        name: p.name,
        description: p.description,
        longDescription: p.longDescription,
        version: p.version,
        author: p.author,
        group: p.group,
        state: stateFor(p.id)
      })
    )
    return [...core, ...fromCatalog, ...localOnly]
  }, [catalog, enabled])

  const groups = useMemo(() => {
    const byGroup = new Map<string, Entry[]>()
    for (const e of entries) {
      byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e])
    }
    return [...byGroup.entries()]
  }, [entries])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Store className="size-5" /> Marketplace
        </h2>
        <p className="text-muted-foreground text-sm">
          Everything optional lives here: built-in modules and installed
          plugins.
          {isAdmin
            ? ' Enable installed plugins instantly; installing new ones takes a redeploy.'
            : ' Ask an admin to enable the ones you need.'}
        </p>
      </div>

      {groups.map(([group, groupEntries]) => (
        <section key={group} className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            {group}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {groupEntries.map((entry) => (
              <PluginCard
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                canInstall={canInstall}
                onOpen={() => setSelected(entry)}
                onChanged={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      ))}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <DetailSheet
              entry={selected}
              isAdmin={isAdmin}
              canInstall={canInstall}
              onChanged={() => {
                router.refresh()
                setSelected(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StateBadge({
  state,
  kind
}: {
  state: EntryState
  kind: Entry['kind']
}) {
  if (state === 'enabled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300">
        <BadgeCheck className="size-3" /> Enabled
      </span>
    )
  }
  if (state === 'installed') {
    return (
      <span className="text-muted-foreground bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
        {kind === 'core' ? 'Off' : 'Installed'}
      </span>
    )
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium">
      <Download className="size-3" /> Not installed
    </span>
  )
}

function PluginCard({
  entry,
  isAdmin,
  canInstall,
  onOpen,
  onChanged
}: {
  entry: Entry
  isAdmin: boolean
  canInstall: boolean
  onOpen: () => void
  onChanged: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-muted/40 flex flex-col gap-2 rounded-lg border p-4 text-left transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Plain <img>: a registry icon can point anywhere, and
              next/image would need every host in next.config remotePatterns. */}
          {entry.iconUrl && (
            // A registry icon URL is arbitrary; next/image would need every
            // possible host in next.config remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.iconUrl}
              alt=""
              className="size-6 shrink-0 rounded"
              loading="lazy"
            />
          )}
          <p className="truncate font-medium">{entry.name}</p>
        </div>
        <StateBadge state={entry.state} kind={entry.kind} />
      </div>
      <p className="text-muted-foreground text-sm">{entry.description}</p>
      <p className="text-muted-foreground text-xs">
        {entry.kind === 'core'
          ? 'Built-in module'
          : `v${entry.version} · ${entry.author}`}
      </p>
      <div onClick={(e) => e.stopPropagation()}>
        <ActionButton
          entry={entry}
          isAdmin={isAdmin}
          canInstall={canInstall}
          onChanged={onChanged}
        />
      </div>
    </button>
  )
}

function ActionButton({
  entry,
  isAdmin,
  canInstall,
  onChanged
}: {
  entry: Entry
  isAdmin: boolean
  canInstall: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()

  function toggle(enabled: boolean) {
    startTransition(async () => {
      const res = await setFeatureEnabled(entry.featureKey, enabled)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(
        enabled ? `${entry.name} enabled.` : `${entry.name} disabled.`
      )
      onChanged()
    })
  }

  function request() {
    startTransition(async () => {
      const res = await requestPlugin(entry.id, entry.name)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Request sent to your admins.')
    })
  }

  function install() {
    startTransition(async () => {
      const res = await installPlugin(entry.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      // The commit triggers a rebuild; the plugin only exists once that
      // finishes, so promise a wait rather than a result.
      toast.success(
        `${entry.name} committed. It appears here once the redeploy finishes.`
      )
      onChanged()
    })
  }

  if (entry.state === 'not-installed') {
    if (!isAdmin) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={request}
        >
          Request
        </Button>
      )
    }
    // Without an install target configured there is nothing to commit to;
    // the detail sheet still explains the manual route.
    return canInstall ? (
      <Button variant="outline" size="sm" disabled={pending} onClick={install}>
        {pending ? 'Installing…' : 'Install'}
      </Button>
    ) : null
  }
  if (isAdmin) {
    return entry.state === 'enabled' ? (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => toggle(false)}
      >
        Disable
      </Button>
    ) : (
      <Button size="sm" disabled={pending} onClick={() => toggle(true)}>
        Enable
      </Button>
    )
  }
  return entry.state === 'enabled' ? null : (
    <Button variant="outline" size="sm" disabled={pending} onClick={request}>
      Request
    </Button>
  )
}

function DetailSheet({
  entry,
  isAdmin,
  canInstall,
  onChanged
}: {
  entry: Entry
  isAdmin: boolean
  canInstall: boolean
  onChanged: () => void
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {entry.name} <StateBadge state={entry.state} kind={entry.kind} />
        </SheetTitle>
        <SheetDescription>{entry.description}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6 text-sm">
        {entry.longDescription && (
          <p className="leading-relaxed whitespace-pre-line">
            {entry.longDescription}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {entry.kind === 'core'
            ? 'Built-in module'
            : `Version ${entry.version} · by ${entry.author}`}
        </p>
        {entry.repoUrl && (
          <a
            href={entry.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-teal-600 hover:underline dark:text-teal-400"
          >
            Source <ExternalLink className="size-3" />
          </a>
        )}

        {entry.kind === 'plugin' &&
          entry.state === 'not-installed' &&
          isAdmin && (
            <div className="bg-muted/50 flex flex-col gap-2 rounded-md border p-3">
              <p className="font-medium">
                {canInstall ? 'What Install does' : 'Install (one redeploy)'}
              </p>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
                <li>
                  Copy <code>plugins/{entry.id}/</code> from the plugin repo
                  into your deployment&apos;s <code>plugins/</code> folder.
                </li>
                <li>
                  Register it: one import line each in{' '}
                  <code>plugins.config.ts</code> and{' '}
                  <code>plugins.config.server.ts</code>.
                </li>
                <li>
                  Push — the build applies the plugin&apos;s migrations
                  automatically, then enable it here.
                </li>
              </ol>
            </div>
          )}

        <ActionButton
          entry={entry}
          isAdmin={isAdmin}
          canInstall={canInstall}
          onChanged={onChanged}
        />
      </div>
    </>
  )
}
