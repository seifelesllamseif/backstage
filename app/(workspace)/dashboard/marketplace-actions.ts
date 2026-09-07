'use server'

import { z } from 'zod'
import { getCurrentTeamMember } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendPushToMember } from '@/lib/push'
import { logActivity } from '@/supabase/dashboard/mutations'
import { config } from '@/lib/config'
import bundledRegistry from '@/marketplace/registry.json'

// Canonical catalog is served by the marketplace site (browse + votes at
// backstage-marketplace.vercel.app), so every self-hosted install sees new
// plugins without updating. The bundled copy is the offline/failure
// fallback. The endpoint may include extra fields (score, votes) — the
// non-strict zod schema below strips them.
const DEFAULT_REGISTRY_URL =
  'https://backstage-marketplace.vercel.app/api/registry'

const CatalogEntry = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  version: z.string().max(20),
  author: z.string().max(60),
  group: z.string().max(30),
  repoUrl: z.string().url(),
  // Optional square logo shown on the card. Absent = today's text-only
  // layout, so older registries keep rendering unchanged.
  iconUrl: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional()
})
const Catalog = z.object({ plugins: z.array(CatalogEntry) })

export type MarketplaceCatalogEntry = z.infer<typeof CatalogEntry>

export async function getMarketplaceCatalog(): Promise<
  MarketplaceCatalogEntry[]
> {
  const member = await getCurrentTeamMember()
  if (!member) return []

  const url = process.env.MARKETPLACE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`registry fetch ${res.status}`)
    // The URL is remote input — validate the shape before it reaches UI.
    return Catalog.parse(await res.json()).plugins
  } catch {
    return Catalog.parse(bundledRegistry).plugins
  }
}

// Member "request this module/plugin" — notifies every admin in the workspace.
// Deliberately no tracking table: a push + email is the whole feature.
export async function requestPlugin(
  pluginId: string,
  pluginName: string
): Promise<{ ok: true } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const parsed = z
    .object({
      id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
      name: z.string().min(1).max(60)
    })
    .safeParse({ id: pluginId, name: pluginName })
  if (!parsed.success) return { error: 'Invalid plugin.' }

  const supabase = createAdminClient()
  const { data: admins } = await supabase
    .from('team_members')
    .select('id, email, contact_email')
    .eq('company_id', member.companyId)
    .eq('access_tier', 'admin')
    .eq('activity_status', 'active')

  const title = `${member.fullName} requested a Marketplace module`
  const body = `${parsed.data.name} — open the Marketplace to enable it.`
  await Promise.allSettled(
    (admins ?? []).flatMap((admin) => [
      sendPushToMember(admin.id, {
        title,
        body,
        url: '/dashboard/marketplace',
        tag: `plugin-request-${parsed.data.id}`
      }),
      sendEmail({
        to: admin.contact_email ?? admin.email,
        subject: `${config.appName}: ${title}`,
        html: `<p>${title}.</p><p>${body}</p>`,
        text: `${title}. ${body}`
      })
    ])
  )

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'plugin_requested',
    'plugin',
    undefined,
    { pluginId: parsed.data.id }
  )
  return { ok: true }
}
