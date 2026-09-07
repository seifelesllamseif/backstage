import type { ComponentType } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TeamMember, AccessTier } from '@/lib/dal'
import type { sendEmail } from '@/lib/email/send'
import type { sendPushToMember } from '@/lib/push'

// A plugin is a folder under plugins/<id>/ registered via two lines in
// plugins.config.ts (client half) and plugins.config.server.ts (server
// half). Enabled state lives in companies.enabled_features as
// `plugin:<id>` alongside the core feature keys. See PLUGINS.md.

export type PluginFeatureKey = `plugin:${string}`

export function pluginFeatureKey(id: string): PluginFeatureKey {
  return `plugin:${id}`
}

// Props every plugin panel receives from PluginHost. Deliberately small:
// panels fetch their own data through invokePluginAction.
export type PluginPanelProps = {
  member: {
    id: string
    accessTier: AccessTier
    isOwner: boolean
  }
}

export type PluginManifest = {
  // ^[a-z][a-z0-9-]*$ — becomes the route (/dashboard/p/<id>) and the
  // feature key (plugin:<id>). Never rename after release: the id is
  // baked into migration version rows and enabled_features arrays.
  id: string
  name: string
  // One-liner for cards and the settings list.
  description: string
  // Markdown, shown in the marketplace detail sheet.
  longDescription?: string
  version: string
  author: string
  // Matches the FEATURES groups ('Team' | 'Work' | 'Polish' | ...).
  group: string
  icon: ComponentType<{ className?: string }>
  nav: {
    label: string
    // Minimum access tier that sees the nav item. Default: everyone.
    minTier?: AccessTier
    hint?: string
  }
  // Wrap with next/dynamic inside the manifest so disabled plugins never
  // join the shell chunk: dynamic(() => import('./Panel'), { ssr: false })
  Panel: ComponentType<PluginPanelProps>
  // Extra command-palette entries; selecting any navigates to the panel.
  palette?: { label: string }[]
  // FirstRunWizard presets this plugin joins when installed.
  presets?: ('solo' | 'team' | 'full')[]
}

// Handed to every server action handler by invokePluginAction. The admin
// client bypasses RLS: every query MUST scope .eq('company_id',
// ctx.companyId) — that is the entire tenancy model.
export type PluginContext = {
  member: TeamMember
  companyId: string
  // Deliberately schema-untyped: plugin tables live outside the generated
  // core Database types. Plugins bring their own row types.
  admin: SupabaseClient
  // Pre-bound to (admin, companyId, member.id).
  logActivity: (
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>
  sendEmail: typeof sendEmail
  sendPushToMember: typeof sendPushToMember
  revalidateDashboard: () => void
}

// Payload is untrusted client input — handlers zod-parse it themselves.
export type PluginActionHandler = (
  ctx: PluginContext,
  payload: unknown
) => Promise<unknown>

// HTTP methods a plugin route may implement. Explicit union so the
// dispatcher can export exactly these and Next sees them statically.
export type PluginRouteMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'

// A plugin route handler owns its own auth. Plugin routes mount outside
// the session-guarded dashboard, so nothing upstream has checked a
// cookie: protocol endpoints (MCP bearer tokens, signed webhooks)
// authenticate themselves. There is deliberately no PluginContext here —
// at this boundary there is no member yet, and inventing one would mean
// guessing which workspace an anonymous request belongs to.
export type PluginRouteHandler = (
  request: Request
) => Promise<Response> | Response

// Keyed by subpath below the mount point; '' is the mount root. Nested
// paths join with '/' ('oauth/consent').
export type PluginRoutes = Record<
  string,
  Partial<Record<PluginRouteMethod, PluginRouteHandler>>
>

export type PluginServerModule = {
  actions: Record<string, PluginActionHandler>
  // Mounted at /api/p/<id>/<subpath>. This is where plugin HTTP surface
  // belongs; it is namespaced by id so two plugins can never collide.
  routes?: PluginRoutes
  // Mounted at /.well-known/<subpath>, i.e. OUTSIDE the plugin's
  // namespace. Only for protocols that mandate a root discovery path
  // (RFC 9728 protected-resource metadata). Because the namespace is
  // shared, first plugin to claim a path wins — keep entries rare and
  // specific.
  wellKnown?: PluginRoutes
}
