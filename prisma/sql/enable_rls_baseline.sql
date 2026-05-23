-- RLS baseline for all public-schema tables: enable RLS with no policies.
-- See docs/decisions/0008-rls-baseline-without-policies.md for the rationale.
--
-- This is NOT part of Prisma's migration history. Apply via the Supabase MCP
-- (`execute_sql`) or psql after `pnpm prisma migrate dev`. Re-apply if the
-- DB is rebuilt with `prisma migrate reset`.

alter table public.company            enable row level security;
alter table public.crew_member        enable row level security;
alter table public.project            enable row level security;
alter table public.task               enable row level security;
alter table public._prisma_migrations enable row level security;
