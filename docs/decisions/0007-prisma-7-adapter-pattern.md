---
status: accepted
decided_on: 2026-05-23
supersedes_parts_of: 0001, 0006
---

# 0007 — Adopt Prisma 7's adapter + config pattern

## Context

We installed `prisma@^7` and `@prisma/client@^7` per [0001](0001-slice-1-stack.md). Prisma 7 ships two breaking changes that immediately bit when `pnpm prisma generate` ran against our first `schema.prisma`:

1. **`datasource.url` and `directUrl` are no longer valid inside `schema.prisma`.** They were removed and moved to a separate `prisma.config.ts` file consumed by `@prisma/config`. The CLI now exits with `P1012: The datasource property url is no longer supported in schema files` when it sees them.
2. **`new PrismaClient()` no longer opens its own database connection.** It requires either an `adapter` (a driver wrapper such as `@prisma/adapter-pg` over `pg`) or an `accelerateUrl` for Prisma Accelerate. The client itself became a query planner; an adapter executes the queries.

The slice-1 plan picked Supabase + Prisma as the stack. Slice 1 is not big enough to justify Prisma Accelerate, so we need a direct driver adapter.

## Decision

**Adopt the Prisma 7 pattern in full.** Three concrete moves:

### 1. `prisma.config.ts` at the repo root

```ts
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
  migrations: { path: "./prisma/migrations" },
});
```

`schema.prisma`'s `datasource` block keeps only `provider = "postgresql"` and nothing else. The `url` lives in this config file, sourced from `DATABASE_URL` at the project root's `.env` / `.env.local` chain.

### 2. Driver adapter: `@prisma/adapter-pg` + `pg`

Install `@prisma/adapter-pg`, `pg`, and `@types/pg` (dev). The runtime client becomes:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

(Plus the globalThis hot-reload guard from the previous lib/prisma.ts.)

### 3. Single `DATABASE_URL`, pointed at the **Session pooler**

Prisma 7's `Datasource` shape only has `url` and `shadowDatabaseUrl` — no `directUrl`. We point `DATABASE_URL` at Supabase's **Session pooler** (**port 5432**, hostname `aws-N-{region}.pooler.supabase.com`, user `postgres.{project_ref}`). `.env.example` has a single `DATABASE_URL`.

> Port reference: **Session pooler = 5432**, Transaction pooler = 6543, Direct = 5432 (different host: `db.<ref>.supabase.co`, IPv6-only). The Session pooler reuses port 5432 but on the pooler hostname — easy to confuse with Direct.

> **Note (revised after first migrate attempt):** The original draft of this decision picked the *Transaction* pooler. That fails: Prisma's migrate engine takes advisory locks to coordinate migrations, and transaction-pooled connections silently strip them, so `prisma migrate dev` hangs forever on `cli can-connect-to-database`. The **Session pooler** behaves like a direct connection (full session features, advisory locks supported) but is reachable over IPv4 without an add-on. It's the right URL for both migrate and the runtime `pg` adapter. Slightly more runtime connections than the transaction pooler — fine under 50 users.

If we ever outgrow this, the operationally-correct upgrade is two URLs: keep DATABASE_URL on transaction pooler for app runtime, add a second `MIGRATE_DATABASE_URL` on session pooler, and shell-override at migrate time (`DATABASE_URL=$MIGRATE_DATABASE_URL pnpm prisma migrate ...`).

### 4. Operational note: password exposure via `ps`

Prisma invokes its `schema-engine` binary with the full datasource URL as a literal command-line argument. The password is therefore visible to any process that can read this machine's process table (e.g. `ps aux`) for the duration of any `prisma` CLI run. This is inherent to how Prisma 7 wires the engine; it is not something the config file or adapter can hide.

On a single-user dev machine the practical risk is low, but rotate the DB password if anyone with shell access shouldn't see it, and don't run `prisma` on shared machines without considering this. The production app uses the `pg` adapter directly and does **not** spawn the schema-engine, so this exposure is dev-only.

## Consequences

- **Deps added** beyond [0001](0001-slice-1-stack.md): `@prisma/adapter-pg`, `pg`, `@types/pg`. Total slice-1 footprint goes from 6 new packages to 9. Decision 0001's install list is amended, not replaced.
- **`prisma.config.ts` is a real source file** at the repo root, alongside `next.config.ts`. It is checked in. It is the only place Prisma reads connection details from — `schema.prisma` cannot.
- **Migration command** is unchanged from [0006](0006-prisma-migrations-workflow.md) — `pnpm prisma migrate dev`. Prisma picks up `prisma.config.ts` automatically.
- **Runtime client** must be constructed with the adapter every time. `lib/prisma.ts` is the only place we do this; nothing else should `new PrismaClient(...)`.
- The `accelerateUrl` path is left available — if/when slice 4+ wants edge-runtime query support, we can swap the adapter for `accelerateUrl` and the rest of the app code keeps working.
