---
status: accepted
decided_on: 2026-05-29
---

# 0027 - Supabase as the data layer (Prisma deprecation)

## Context

Up to this point the data layer was Prisma 7 (with `@prisma/adapter-pg`)
against a Supabase Postgres - Prisma owned the schema, migrations, and
all server-action queries, while Supabase only provided Auth and the
underlying database. The boundary lived in decision
[0002](0002-supabase-prisma-boundary.md), revised in
[0016](0016-revised-supabase-prisma-boundary.md): Supabase owns
`auth.users`, Prisma owns everything else.

For the Verbivore rebrand a brand-new Supabase project was created:

- name: `Backstage`
- ref: `nkvgvfdmtvdabtpppanj`
- region: eu-central-1
- Postgres 17

The user decided to drop Prisma and use `@supabase/supabase-js` directly
for data access on the new project. Reasons (paraphrasing):

- One vendor for auth + data + (eventually) realtime + storage.
- Schema lives in Supabase migrations, not split between
  `prisma/schema.prisma` and the DB.
- Removes the Prisma 7 adapter quirks (cross-schema FK drift, pooler
  URL split, the `APP_DATABASE_URL` vs `DATABASE_URL` dance).

## Decision

### Schema

The 12 Prisma migrations are squashed into one Supabase migration
`init_schema` at the head of the new project. This is the *final*
state of `prisma/schema.prisma`. The Prisma migrations folder stays in
the repo as a read-only legacy record; future schema changes go to
`supabase/migrations/` (or via the MCP `apply_migration` tool).

A second migration `enable_rls_no_policies` flips RLS on for every
public table without writing policies. Service-role connections
(Prisma during the transition, the seed script's Supabase admin client,
future server-side `createClient(..., serviceKey)` calls) bypass RLS
and continue to work. The anon and authenticated roles see nothing
until policies land.

### Transition shape

Prisma is **not** removed yet. The full list of files still importing
`@/lib/prisma` is roughly:

- `lib/dal.ts`
- `app/(workspace)/projects/[id]/actions.ts`
- `app/(workspace)/projects/[id]/page.tsx`
- `app/(workspace)/projects/[id]/tasks/[taskId]/page.tsx`
- `app/(workspace)/projects/[id]/tasks/[taskId]/handoff-actions.ts`
- `app/(workspace)/dashboard/actions.ts`
- `app/(workspace)/dashboard/page.tsx`
- `app/(portfolio)/portfolio/page.tsx`
- `app/(authenticated)/projects/page.tsx`
- `app/(authenticated)/projects/actions.ts`

Each will be migrated to a Supabase client call in a follow-up pass,
file by file, with RLS policies written alongside. Until that pass:

- `@prisma/client`, `@prisma/adapter-pg`, `@prisma/config`, and `prisma`
  stay in `package.json`.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio`
  keep working.
- `lib/prisma.ts` keeps reading `APP_DATABASE_URL` (transaction pooler).
- `lib/supabase/{server,client,proxy}.ts` continue using the anon key
  for cookie-based auth.

### Seed

The existing TS seed `prisma/seed.ts` already creates the six auth
users with the service-role admin client and inserts the rest through
Prisma. With the new `.env.local` pointing at project
`nkvgvfdmtvdabtpppanj`, `pnpm db:seed` works against it as-is. Port to
a pure-SQL seed lands later, alongside the dal.ts migration.

### RLS policy plan (deferred)

Policy outline for when the migration runs:

- Every table predicate joins on `company_id = (the current user's
  team_member.company_id)`. The single-company scope of slice-1 keeps
  this simple.
- `auth.uid()` resolves to the current user; `team_member.id =
  auth.uid()` is the existing bridge from decision 0016.
- `accessTier` ('admin' / 'lead' / 'member') gates write paths.

This decision intentionally does *not* freeze the exact policy SQL -
that lands in a later decision when the first file is migrated.

## Consequences

- **Two truths during the transition.** `prisma/schema.prisma` and the
  Supabase migration history agree today. A future schema change must
  be applied in *both* places, or one will drift. The fix is to finish
  the migration; the workaround is a checklist in PR descriptions.
- **Service role is the only thing that works right now.** A
  publishable-key client call from the browser will get back zero rows
  for every table. This is intentional; it forces every read path to
  go through the server (matching current Prisma behavior) until
  policies are written.
- **Slug rename.** The seeded company slug is now `verbivore` (decision
  0026). Anyone with a `slug: "skam"` row in their old dev DB needs to
  point .env.local at the new project (or reset locally).
- **The old Supabase project** (`myncqewjjoqkjdlsuuqg`, name "backstage",
  eu-west-2) is now orphaned. Not deleted - user decides when to pause
  or remove it.

## What this does NOT decide

- Whether to keep the `dashboard-loader` / progress bar pattern as
  Prisma calls move to RSC streams.
- Anything about realtime, storage, or edge functions.
- The exact RLS policy SQL.
- Migration order for the 10 Prisma files. The first one to migrate is
  whichever surface needs editing next for a feature.
