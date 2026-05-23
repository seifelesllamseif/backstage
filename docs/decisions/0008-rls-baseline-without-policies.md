---
status: accepted
decided_on: 2026-05-23
---

# 0008 — RLS baseline on all public tables, no policies yet

## Context

After the init migration ([0006](0006-prisma-migrations-workflow.md)) the five tables in `public` (`company`, `crew_member`, `project`, `task`, plus Prisma's `_prisma_migrations`) had RLS disabled. The Supabase MCP raised a critical advisory: every public-schema table is reachable via PostgREST using the `anon` key, and the `anon` key is published in the browser via `NEXT_PUBLIC_SUPABASE_ANON_KEY`. With RLS off and no row-level policies, *anyone with the anon key can read or modify every row* through a direct REST call — bypassing the app's Prisma server-side path entirely.

The slice-1 plan §3 explicitly defers **RLS policies** to a later slice, framing it as "single company for now; add when multi-tenant is real." But "enable RLS with no policies" is a different lever: it's a deny-all baseline that costs five `ALTER TABLE` statements and removes the exposure without bringing policy design forward. Prisma keeps working unchanged because its `postgres` connection has `BYPASSRLS`.

## Decision

Enable RLS on all five public-schema tables now. Write no policies. The five statements live in `prisma/sql/enable_rls_baseline.sql` and are applied via the Supabase MCP `execute_sql` (parallel to how the auth FK is applied — see [0006](0006-prisma-migrations-workflow.md)).

```sql
alter table public.company           enable row level security;
alter table public.crew_member       enable row level security;
alter table public.project           enable row level security;
alter table public.task              enable row level security;
alter table public._prisma_migrations enable row level security;
```

No `create policy` statements. With RLS on and no policies, the `anon` and `authenticated` roles get zero rows from every table on every operation. The `postgres` role (which Prisma uses via the pooler) bypasses RLS, so the app is unaffected.

## Consequences

- **PostgREST exposure is closed.** Any client hitting `https://<ref>.supabase.co/rest/v1/<table>` with the anon key gets an empty result (or a permission error on writes) until policies are written.
- **Direct Supabase JS client calls won't return rows either.** If we ever want client-side direct reads (e.g. for a public landing-page query), we'll need a targeted `SELECT` policy for that table/operation. Slice 1 has no such surface — all reads go through server routes hitting Prisma.
- **`_prisma_migrations` is locked down too.** Prisma manages it through the `postgres` role, so unaffected. Anyone reaching it through PostgREST sees nothing.
- **Slice 2 / 3 will need to add policies** when auth is wired and we want to expose any read path to the browser via PostgREST. That's a deliberate, scoped decision — design the policy alongside the screen that needs it.
- The Supabase MCP's RLS advisory will clear after this is applied.

## How to apply

```bash
# Via Supabase MCP (current session, or a new agent):
mcp__supabase__execute_sql with the contents of prisma/sql/enable_rls_baseline.sql

# Or via psql:
psql "$DATABASE_URL" -f prisma/sql/enable_rls_baseline.sql
```

Re-apply if `prisma migrate reset` is ever run (along with the auth FK from [0006](0006-prisma-migrations-workflow.md)).
