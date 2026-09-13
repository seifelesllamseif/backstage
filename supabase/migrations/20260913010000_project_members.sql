-- Explicit project membership. Until now "who is on this project" was
-- derived in fetch.ts from task assignments and watchers, which meant you
-- could not put someone on a project before there was work for them, and
-- unassigning their last task silently revoked their access.
--
-- Additive on purpose: fetch.ts unions these rows with the existing derived
-- rules rather than replacing them, so nothing anyone can see today goes
-- away when this ships. That is also why there is no backfill.
--
-- company_id is denormalised so scoping stays one indexed lookup and the
-- query carries the same .eq('company_id', ...) filter as everything else
-- in this codebase.

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  added_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, member_id)
);

-- Scoping reads by member ("which projects am I on") is the hot path.
create index if not exists project_members_member_idx
  on public.project_members (member_id);
create index if not exists project_members_company_idx
  on public.project_members (company_id);

-- RLS on with no policies, matching 20260913000000_enable_rls_dormant_tables:
-- every read and write goes through the service-role admin client, which
-- bypasses RLS, and nothing subscribes to this table over realtime.
alter table public.project_members enable row level security;
