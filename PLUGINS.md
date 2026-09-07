# Writing a Backstage plugin

A plugin is a self-contained folder under `plugins/<id>/` that ships its
own dashboard panel, nav item, server actions, and database tables.
Plugins are compiled into the app at build time (this is a Vercel-style
deployment: there is no runtime code loading). Enabling/disabling per
workspace is instant, from the in-app Marketplace.

The `plugins/polls` folder is the reference implementation — copy it.

## Anatomy

```
plugins/<id>/
  manifest.tsx     # client-safe metadata + the Panel (next/dynamic)
  shared.ts        # zod schemas + types used by both sides
  Panel.tsx        # 'use client' UI, mounted at /dashboard/p/<id>
  server.ts        # 'server-only' action handlers
  migrations/
    0001_<slug>.sql
```

Install from the in-app Marketplace with one click: the button commits the
plugin folder plus the two lines below into your deployment's own repo, and
the platform rebuilds. The repo is derived from `VERCEL_GIT_REPO_*`, so the
only setup is an admin connecting a GitHub token under Settings → Plugin
installs. Until that is connected, the panel shows these manual steps.

Install = two lines, then redeploy:

```ts
// plugins.config.ts
import myPlugin from '@/plugins/my-plugin/manifest'
export const PLUGINS = [myPlugin]

// plugins.config.server.ts
import myPluginServer from '@/plugins/my-plugin/server'
export const PLUGIN_SERVERS = { 'my-plugin': myPluginServer }
```

## The manifest (`manifest.tsx`)

See `PluginManifest` in `lib/plugins/types.ts`. Rules:

- `id` matches `^[a-z][a-z0-9-]*$`. It becomes the route
  (`/dashboard/p/<id>`) and the feature key (`plugin:<id>`). **Never
  rename it after release** — it is baked into migration version rows
  and workspaces' `enabled_features` arrays.
- `Panel: dynamic(() => import('./Panel'))` — plain `dynamic()` only.
  `ssr: false` is rejected because manifests are also imported by server
  code.
- `presets` opts your plugin into the first-run presets so fresh
  workspaces that pick e.g. "Small team" get it enabled automatically.

## The client/server wall

`manifest.tsx`, `shared.ts`, and `Panel.tsx` are bundled into the
browser: they must never import `server.ts` or anything server-only.
`server.ts` must start with `import 'server-only'` — that turns an
accidental client import into a loud build failure instead of a silent
secrets leak. Shared zod schemas live in `shared.ts` so the panel never
has a reason to touch `server.ts`.

## Server actions

`server.ts` default-exports `{ actions: { name: handler } }`. Handlers
receive `(ctx: PluginContext, payload: unknown)`:

- `payload` is untrusted client input — **always** parse it with zod
  first.
- `ctx.admin` is the service-role Supabase client and **bypasses RLS**.
  App-level scoping is the entire tenancy model: every query MUST chain
  `.eq('company_id', ctx.companyId)`. No exceptions.
- `ctx.logActivity(action, entityType, entityId?, metadata?)` on every
  mutation — it feeds the audit trail and activity feeds.
- `ctx.sendEmail` / `ctx.sendPushToMember` for notifications;
  `ctx.revalidateDashboard()` if you change data that server components
  render.

The panel calls handlers through the one dispatch action:

```ts
import { invokePluginAction } from '@/app/(workspace)/dashboard/plugin-actions'
const result = await invokePluginAction('<id>', 'actionName', payload)
```

Dispatch already guards the session and the plugin's enabled flag; your
handler still owns input validation and any tier checks
(`ctx.member.accessTier`).

## HTTP routes

Server actions cover anything the panel calls. A plugin that has to speak
a wire protocol — MCP, an inbound webhook, an OAuth callback — needs a
real URL, so `server.ts` may also export `routes`:

```ts
export default {
  actions: { ... },
  routes: {
    '': { POST: handleMcp },              // /api/p/<id>
    'oauth/consent': { GET: renderConsent } // /api/p/<id>/oauth/consent
  }
}
```

Keys are the subpath below the mount (`''` is the plugin root), values
map HTTP method to a handler taking a `Request` and returning a
`Response`. Mounted by the catch-all at `app/api/p/[id]/[[...path]]`.

**Routes are not server actions, and the difference is the security
model.** `invokePluginAction` has already checked the session and the
plugin's enabled flag before your handler runs. A route has had *none* of
that: `/api/p/*` is absent from `protectedRoutes`, so `proxy.ts` waves it
through unauthenticated. That is deliberate — a protocol client carries a
bearer token or a signed webhook body, not a browser cookie — but it
means **your handler owns its own authentication**, and a route that
forgets is an open endpoint. There is no `PluginContext` at this
boundary because there is no member yet.

Anything a route does after authenticating still owes the same
`.eq('company_id', ...)` scoping as an action.

> A worked example of all of this ships in `plugins/mcp/` — it mounts a
> workspace-scoped MCP endpoint plus RFC 9728 discovery metadata. See
> `docs/MCP.md`.

### `.well-known`

Discovery documents are specified at fixed root-relative paths, so they
cannot live under `/api/p/<id>`. A plugin may claim one with `wellKnown`,
which mounts at the domain root:

```ts
wellKnown: {
  'oauth-protected-resource': { GET: metadata }  // /.well-known/oauth-protected-resource
}
```

This namespace is shared across plugins and the first claim wins
(iteration order is `plugins.config.server.ts`). Use it only where a spec
demands the path; everything else belongs in `routes`.

## Migrations

- Files run in filename order: `0001_*.sql`, `0002_*.sql`, ...
- Applied automatically during `pnpm build` by `scripts/migrate.mjs`,
  tracked as `zplugin_<id>_<prefix>` in the same
  `supabase_migrations.schema_migrations` table the Supabase CLI uses.
- Never rename an applied migration file or the plugin folder.
- Prefer idempotent DDL (`create table if not exists`) — installs that
  predate the tracking rows re-run cleanly.
- Every table gets a `company_id uuid not null` column (see the tenancy
  rule above) and an index on it.
- No down migrations. Uninstalling a plugin leaves its tables; drop them
  manually if you care.

## Publishing to the Marketplace catalog

The catalog every install browses is `marketplace/registry.json` on
`seifelesllamseif/backstage` `main`. Open a PR adding your entry:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "One line, max 200 chars.",
  "version": "0.1.0",
  "author": "you",
  "group": "Team",
  "repoUrl": "https://github.com/you/backstage-plugin-my-plugin"
}
```

Self-hosters can point `MARKETPLACE_REGISTRY_URL` at their own registry
JSON instead.
