-- Foreign key from public.crew_member to Supabase's auth.users.
--
-- This statement is NOT part of Prisma's migration history. It is applied
-- separately via the Supabase MCP `execute_sql` (or `psql`) after
-- `pnpm prisma migrate dev` has run. See docs/decisions/0006 for the flow
-- and docs/decisions/0002 for why the FK lives outside Prisma's domain.
--
-- Re-apply this snippet if the DB is ever rebuilt with `prisma migrate reset`.

alter table public.crew_member
  add constraint crew_member_auth_user_fk
  foreign key (id) references auth.users(id) on delete cascade;
