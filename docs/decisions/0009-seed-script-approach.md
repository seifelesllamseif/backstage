---
status: accepted
decided_on: 2026-05-23
---

# 0009 — Seed script approach

## Context

Slice-1 plan §2 calls for seed data: one company, ~6 people, 2 projects, ~15 tasks, "so it is testable." With the schema applied and the [auth ↔ Prisma boundary](0002-supabase-prisma-boundary.md) in place, seeding has a real dependency: every `team_member.id` must match an `auth.users.id`. So the seed script must create Supabase auth users *first*, then the matching `team_member` rows via Prisma.

That requires the **service role key** (Supabase Dashboard → Settings → API → "service_role" secret). The service role key bypasses RLS and can call `supabase.auth.admin.*` — never expose it client-side, never prefix with `NEXT_PUBLIC_`.

## Decision

### Behavior

- **One-shot.** Seed checks for the Verbivore company row first; if it exists, exits with a clear error ("DB already seeded — run `pnpm prisma migrate reset` to start over"). No destructive deletes inside seed. No upserts. To re-seed: `pnpm prisma migrate reset` then `pnpm db:seed`.
- **Auto-confirmed auth users with a shared dev password.** Every seeded user gets the password `backstage-dev`. Users are created via `supabase.auth.admin.createUser({ email, password, email_confirm: true })` so they can sign in immediately. Slice 4+ can swap to magic-link or stricter flows.
- **Login table printed at the end.** Seed prints a small table with each seeded user's email + access tier so the developer can pick any of the six and log in.

### Tooling

- Seed file: `prisma/seed.ts`.
- Runner: `tsx` (dev dependency). Prisma 7's `prisma.config.ts` reads the seed command from `migrations.seed`, set to `"tsx prisma/seed.ts"`.
- Convenience script: `pnpm db:seed` in `package.json` (so it can run outside the `prisma migrate reset` flow).
- Imports: `@supabase/supabase-js` (admin client, service role key) + `@/lib/prisma` (Prisma client via the pg adapter).

### Data shape

One company:
- name: **Verbivore**, slug: `verbivore`

Six people (VERB-themed; `.test` TLD so the emails never collide with real addresses):

| Email | Name | Access | Notes |
|---|---|---|---|
| `iman@verbivore.test` | Iman Hadi | admin | founder |
| `tariq@verbivore.test` | Tariq Yusuf | lead | producer |
| `layla@verbivore.test` | Layla Saeed | member | design |
| `omar@verbivore.test` | Omar Khalil | member | audio |
| `nadia@verbivore.test` | Nadia Farouk | member | casting |
| `karim@verbivore.test` | Karim Saleh | member | writing |

Two projects:
- **Operations** (`kind=operations`) — the standing project per slice-1 plan.
- **Pilot Episode** (`kind=standard`) — flagship work to populate the board.

~15 tasks distributed across both projects, all six statuses (including a `canceled` outlier), and the six people. Two tasks have due dates in the past so the overdue red treatment renders. A few tasks are unassigned to exercise the empty-assignee path.

## Consequences

- **`.env.local` gains `SUPABASE_SERVICE_ROLE_KEY`**, added as a placeholder to `.env.example`. Server-only — no `NEXT_PUBLIC_` prefix.
- **Seeded users have a known shared password.** Acceptable in dev because the project is single-tenant and the .test domain is fake. If we ever point this seed at a shared staging DB, switch to a random per-user password before running.
- **`prisma migrate reset` reseeds automatically** because the command is wired into `prisma.config.ts`. To run seed alone: `pnpm db:seed`.
- **`tsx` is the seed runner.** No global install required; runs via `pnpm` from devDependencies.
- **The auth FK ([0002](0002-supabase-prisma-boundary.md)) is invisible to Prisma but live in Postgres.** When seed creates a `team_member` row, the FK requires the matching `auth.users.id` to already exist. Seed enforces order: create auth user → grab returned UUID → insert `team_member` with that UUID as `id`.
