---
status: accepted
decided_on: 2026-05-23
supersedes_parts_of: 0002, 0006
---

# 0016 — Drop the `team_member.id → auth.users.id` foreign key

## Context

[Decision 0002](0002-supabase-prisma-boundary.md) established the Prisma ↔ Supabase boundary: Supabase owns the `auth` schema; Prisma owns `public`. To keep `team_member.id` tied to `auth.users.id` we wrote a hand-managed cross-schema FK in `prisma/sql/team_member_auth_fk.sql`, applied via the Supabase MCP after `prisma migrate`.

Slice 2's first `prisma migrate dev --name add_handoff` exposed the cost of that pattern under Prisma 7:

1. Prisma 7's pre-migration introspection refused to proceed because the cross-schema FK target (`auth.users`) wasn't in the datasource `schemas` list. Error `P4002`.
2. Adding `schemas = ["public", "auth"]` to the datasource (with `previewFeatures = ["multiSchema"]` on the generator) made Prisma 7 introspect the entire `auth` schema as drift — it surfaced ~10 modern Supabase auth tables (`oauth_authorizations`, `webauthn_credentials`, `custom_oauth_providers`, etc.) plus the FK on `team_member` itself, and demanded a database **reset** to reconcile.
3. Even with `experimental.externalTables = true` + an explicit `tables.external` allowlist in `prisma.config.ts`, the list of Supabase auth tables changes between Supabase releases. Maintaining a complete enumeration is brittle and silently breaks on the next Supabase upgrade.

The FK was load-bearing for one behavior only: cascade-delete of `team_member` when an `auth.users` row is deleted. In practice we never delete auth users in slice 1 or 2 (the seed creates them; nothing removes them). The cost of keeping the FK across migrations outweighed the value.

## Decision

**Drop the cross-schema FK permanently.** Revert the schema/config to single-schema (`public` only), no multi-schema flags, no external-tables list.

### What this changes

- `prisma/schema.prisma` — datasource has no `schemas` property (default = public only); no `@@schema(...)` directives on models; generator has no `previewFeatures = ["multiSchema"]`.
- `prisma.config.ts` — no `experimental.externalTables`, no `tables.external`.
- The Postgres FK `team_member_auth_user_fk` was dropped via the Supabase MCP (`alter table public.team_member drop constraint team_member_auth_user_fk`).
- `prisma/sql/team_member_auth_fk.sql` is **no longer applied** to new databases. Kept in the repo for the historical record and in case a future slice wants to re-introduce it through a different mechanism.

### What stays the same

The boundary from [0002](0002-supabase-prisma-boundary.md) is otherwise intact:

- **`team_member.id` still equals an `auth.users.id`.** The seed and any future signup flow create the auth user first, then insert the `team_member` with that id. This is an application-level invariant now, not a database-level one.
- Prisma still owns `public`; Supabase still owns `auth`. They just don't touch each other through a constraint.

### Trade-offs we accept

- **No cascade-delete.** Deleting an `auth.users` row leaves an orphan `team_member` row referencing a missing user. Today this is a hypothetical because we never delete auth users; if we add a "remove a teammate" flow later, the server action does both deletes in order (auth admin API → Prisma delete) and we're done.
- **No referential integrity at the database level.** An incorrect application path could insert a `team_member` with a non-existent `id`. Mitigation: all writes go through `lib/dal.ts` / server actions that derive the id from a verified auth session — the path can't realistically produce a bogus value.
- **Future slices that need stronger guarantees** can re-introduce the FK by either: (a) listing every `auth.*` table in `tables.external` (brittle), (b) modeling `auth.users` as a `@@ignore`'d Prisma model and the rest with a wildcard if Prisma 7 ever supports one, or (c) staying with a manual SQL-managed FK and using `prisma db push --accept-data-loss` carefully on every migration. None of these is cheap.

## Consequences

- **The slice-2 (and future) migration loop is normal again.** `pnpm prisma migrate dev --name X` just works without manual SQL stitching.
- **The existing `prisma/migrations/20260523012447_init/migration.sql` is unchanged.** The FK was applied outside of it via MCP, and dropping it is a runtime act, not a migration. `_prisma_migrations` is unaffected.
- **Decision 0006's "Step 4 — apply the auth FK"** is now historical. Future migration runbook is the standard `pnpm prisma migrate dev`, no append.
- **The seed continues to assign `team_member.id = auth.users.id` by application logic.** No code change to `prisma/seed.ts` was needed for this drop.
