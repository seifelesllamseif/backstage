# Backstage

Team ops in one place. Sprint board, one-on-one scheduling, per-member
onboarding checklists, retros, deadline warnings, and the small bits of
polish (emoji reactions, image gallery, AI-paste task import) that make
day-to-day work feel less clunky.

Built for a small studio, then genericized and open-sourced as a
self-host template.

**[Live demo](https://backstage-www.vercel.app/dashboard)** (fully
interactive, in-browser data) ·
**[Plugin marketplace](https://backstage-marketplace.vercel.app)**

![Sprint board hero](screenshots/board.png)

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSEIFSEIF4%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_APP_NAME,NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_APP_EMAIL_DOMAIN,NEXT_PUBLIC_TIMEZONE&envDescription=Branding%20and%20timezone.%20Supabase%20variables%20are%20provisioned%20automatically%20by%20the%20integration.)

One click wires a fresh Supabase project via the Vercel + Supabase
integration, provisions env vars per environment, and deploys. See
[DEPLOY.md](DEPLOY.md) for post-deploy migration steps and optional
integrations.

## Stack

- **Next.js 16** (App Router, Turbopack, Partial Prerender)
- **React 19**, TypeScript, Tailwind CSS v4, Radix UI, Framer Motion
- **Supabase** - Postgres, Auth, Storage, RLS. Talked to via
  `@supabase/supabase-js` and `@supabase/ssr` only (no Prisma).
- **TanStack Query** for cache invalidation, **TanStack Table** for
  the list view, **@dnd-kit** for the board.
- **Resend** for outbound email, **web-push** for browser push.

## Features (modular)

Every non-core module lives behind a feature flag in
`companies.enabled_features`. Admins toggle them under
**Settings > Features**. First run of a fresh workspace prompts a
Solo / Small team / Full preset.

- **Sprints** - auto-cycling weekly sprints, chip-controlled sections,
  auto-add to sprint.
- **Meetings** - 1:1 request flow with approval, shared meet link,
  expiry.
- **Onboarding tracker** - per-member setup checklists driven by tier
  and skill matching.
- **Updates panel** - activity feed, task deletions, meeting events,
  sprint events.
- **Reactions** - emoji reactions on tasks and comments.
- **Image gallery** - multi-image previews attached to tasks.
- **AI paste export** - copy a structured brief of selected tasks for
  pasting into an AI, then paste the JSON response back to bulk-create.
- **Retrospectives** - end-of-sprint retro flow.
- **Portfolio pages** - public `/:handle` member profiles.
- **Brand exporter** - advanced tool, off by default.

## Feature flag system

- `lib/features/keys.ts` - the canonical list, one place to add a new
  key. Includes a `PRESETS` map for the first-run wizard.
- `lib/features/server.ts` - `isFeatureEnabled(key)` and
  `requireFeature(key)` (redirects to `notFound()`) for server components
  and route pages.
- `lib/features/client.tsx` - `useFeature(key)` and
  `useEnabledFeatures()` hooks. Provider is seeded at the workspace
  layout so every client component under `/dashboard/*` can gate itself.

Turning a feature off hides its sidebar entry, 404s direct URLs, and
skips its in-page hooks. Turning it back on reactivates everything with
no data loss.

## Local dev

```bash
pnpm install
cp .env.example .env.local
# fill in Supabase URL + keys
pnpm dev
```

Then apply migrations against your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Open http://localhost:3000, sign in through Supabase Auth, and the
first-run wizard picks up from there.

## Architecture

Design decisions live under [docs/decisions](docs/decisions/). Highlights:

| ADR | Topic |
| --- | --- |
| [0010](docs/decisions/0010-auth-architecture.md) | Auth architecture |
| [0016](docs/decisions/0016-drop-team-member-auth-fk.md) | Dropping the cross-schema team_member -> auth.users FK |
| [0022](docs/decisions/0022-dashboard-as-primary-surface.md) | Dashboard as the primary surface |
| [0023](docs/decisions/0023-member-scoped-dashboard.md) | Member-scoped dashboard |
| [0025](docs/decisions/0025-bulk-task-creation-from-ai-paste.md) | Bulk task creation from AI paste |
| [0027](docs/decisions/0027-supabase-as-data-layer.md) | Supabase as the data layer (no Prisma) |

## Contributions

Not accepting external contributions right now. Fork it, use it, ship
your own thing.

## License

MIT. See [LICENSE](LICENSE).
