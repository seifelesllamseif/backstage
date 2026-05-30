-- =============================================================
-- Crew OS  ·  PostgreSQL schema
-- Internal operations platform: projects, crew planning, task
-- handoff, onboarding, knowledge base.
--
-- PostgreSQL 14+ recommended.
-- Conventions:
--   - snake_case names, UUID primary keys
--   - company_id on every domain table  (multi-tenant-ready, run single-tenant)
--   - timestamptz everywhere, created_at on all tables
--   - auth/session tables are owned by your auth library (Auth.js etc.)
--     and are intentionally NOT in this file. crew_member is the
--     domain profile; link it to your auth user by email or auth_id.
-- =============================================================

-- ---------- enum types ----------------------------------------

create type access_tier        as enum ('admin', 'lead', 'member');
create type contract_type      as enum ('founder', 'employee', 'intern', 'contractor');
create type work_mode          as enum ('onsite', 'remote', 'hybrid');
create type lifecycle_status   as enum ('incoming', 'onboarding', 'active', 'wrapping_up', 'alumni');
create type skill_level        as enum ('beginner', 'intermediate', 'advanced', 'expert');

create type project_kind       as enum ('standard', 'operations');
create type task_status        as enum ('backlog', 'unscoped', 'todo', 'in_progress', 'in_review', 'done', 'canceled');
create type handoff_status     as enum ('in_progress', 'blocked', 'ready_for_review', 'done');

create type milestone_visibility as enum ('project_wide', 'leads_only', 'custom');

create type doc_status         as enum ('empty', 'draft', 'verification_requested', 'verified', 'expired', 'outdated');
create type doc_source         as enum ('native', 'markdown_import', 'gdocs_import', 'file_upload');
create type gap_status         as enum ('open', 'resolved');

create type agreement_status   as enum ('pending', 'signed');
create type onboarding_status  as enum ('not_started', 'in_progress', 'complete');
create type redeploy_type      as enum ('trial', 'permanent', 'split');
create type redeploy_status    as enum ('proposed', 'active', 'completed', 'rolled_back');

create type vault_kind         as enum ('idea', 'quote', 'inspiration', 'source', 'project');
create type vote_type          as enum ('up', 'down');


-- =============================================================
-- DOMAIN A  ·  Tenancy, people, roles & skills
-- =============================================================

-- The tenant. One row today; the model is ready for more.
create table company (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A person: founder, employee, or apprentice. The company-level record.
create table crew_member (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  email           text not null,
  full_name       text not null,
  avatar_url      text,
  access_tier     access_tier   not null default 'member',  -- what you can DO
  title           text,                                     -- what you're CALLED (free text)
  contract_type   contract_type not null default 'intern',
  primary_role_id uuid,                                      -- FK added after role table
  work_mode       work_mode     not null default 'onsite',
  weekly_capacity_hours  numeric(5,1) not null default 40,
  start_date      date,
  end_date        date,                                     -- null = open-ended
  lifecycle_status lifecycle_status not null default 'incoming',
  learning_goals  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, email)
);

-- Roles grouped into families (Production, Post, Tech, Growth...).
create table role_family (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- A role (Developer, Color grader, ...). Company-level, never per-project.
create table role (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  role_family_id  uuid references role_family(id) on delete set null,
  name            text not null,
  is_open         boolean not null default false,  -- actively hiring
  created_at      timestamptz not null default now(),
  unique (company_id, name)
);

-- crew_member -> role (deferred FK now that role exists).
alter table crew_member
  add constraint crew_member_primary_role_fk
  foreign key (primary_role_id) references role(id) on delete set null;

-- The skill catalog. A skill may be tied to a role, or general (role_id null).
create table skill (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  role_id     uuid references role(id) on delete set null,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- The skill tree: a person's secondary skills and their level.
create table crew_skill (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  skill_id        uuid not null references skill(id) on delete cascade,
  level           skill_level not null default 'beginner',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (crew_member_id, skill_id)
);


-- =============================================================
-- DOMAIN B  ·  Projects & allocation
-- =============================================================

-- A unit of work a company runs. 'operations' is the standing lane
-- for non-project work (onboarding, recruiting, the Vault).
create table project (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  kind        project_kind not null default 'standard',
  description text,
  start_date  date,
  end_date    date,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- The link between a person and a project, with their time split.
-- Sum of allocation_pct per crew_member should stay <= 100 (overload check).
create table allocation (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  project_id      uuid not null references project(id) on delete cascade,
  allocation_pct  numeric(5,2) not null default 0
                    check (allocation_pct >= 0 and allocation_pct <= 100),
  started_on      date,
  ended_on        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (crew_member_id, project_id)
);

-- How many of each role a project needs. Capacity demand rolls up from here.
create table role_demand (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  project_id      uuid not null references project(id) on delete cascade,
  role_id         uuid not null references role(id) on delete cascade,
  headcount_min   int not null default 1,
  headcount_max   int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, role_id),
  check (headcount_max >= headcount_min)
);


-- =============================================================
-- DOMAIN C  ·  Tasks & handoff
-- =============================================================

-- Discipline labels (Audio, Design, Casting...).
create table label (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  color       text,
  unique (company_id, name)
);

-- A task. Belongs to exactly one project (the operations lane counts).
create table task (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  project_id    uuid not null references project(id) on delete cascade,
  title         text not null,
  description   text,
  status        task_status not null default 'backlog',
  assignee_id   uuid references crew_member(id) on delete set null,
  due_date      date,
  created_by    uuid references crew_member(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table task_label (
  task_id   uuid not null references task(id) on delete cascade,
  label_id  uuid not null references label(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Dependencies may cross projects.
create table task_dependency (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references company(id) on delete cascade,
  task_id            uuid not null references task(id) on delete cascade,
  depends_on_task_id uuid not null references task(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

-- The handoff doc. A task may be handed off more than once; is_complete
-- is computed from the six required fields and gates Definition of Done.
create table handoff (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  task_id         uuid not null references task(id) on delete cascade,
  from_member_id  uuid references crew_member(id) on delete set null,
  to_member_id    uuid references crew_member(id) on delete set null,
  status          handoff_status not null default 'in_progress',
  what_it_is      text,
  current_status  text,
  done_so_far     text,
  still_left      text,
  file_links      text,
  gotchas         text,
  who_to_ask      text,
  is_complete     boolean generated always as (
                    what_it_is     is not null and
                    current_status is not null and
                    done_so_far    is not null and
                    still_left     is not null and
                    file_links     is not null and
                    gotchas        is not null and
                    who_to_ask     is not null
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- =============================================================
-- DOMAIN D  ·  Timeline
-- =============================================================

-- Roadmap items, scoped to a project. Visibility drives selective access.
create table milestone (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  project_id  uuid not null references project(id) on delete cascade,
  title       text not null,
  description text,
  start_date  date,
  due_date    date,
  visibility  milestone_visibility not null default 'project_wide',
  created_by  uuid references crew_member(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Extra viewers for milestones with visibility = 'custom'.
create table milestone_access (
  milestone_id    uuid not null references milestone(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  primary key (milestone_id, crew_member_id)
);


-- =============================================================
-- DOMAIN E  ·  Knowledge base
-- =============================================================

-- A knowledge doc. owner + verification keep the KB trustworthy,
-- which matters because the AI assistant reads from here.
create table knowledge_doc (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references company(id) on delete cascade,
  project_id        uuid references project(id) on delete set null,  -- null = company-wide
  title             text not null,
  body              text,
  doc_type          text,                       -- role_guide, sop, handbook...
  owner_id          uuid references crew_member(id) on delete set null,
  status            doc_status not null default 'draft',
  source            doc_source not null default 'native',
  verified_at       timestamptz,
  verified_by       uuid references crew_member(id) on delete set null,
  verify_expires_at timestamptz,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Questions the AI could not answer. Each one is a doc waiting to be written.
create table knowledge_gap (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  question        text not null,
  asked_by_id     uuid references crew_member(id) on delete set null,
  status          gap_status not null default 'open',
  resolved_doc_id uuid references knowledge_doc(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Meeting notes: structured, so decisions stop vanishing.
create table meeting (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  project_id    uuid references project(id) on delete set null,
  title         text not null,
  meeting_type  text,
  held_on       date not null,
  notes         text,
  decisions     text,
  created_by    uuid references crew_member(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table meeting_attendee (
  meeting_id      uuid not null references meeting(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  primary key (meeting_id, crew_member_id)
);

-- The tools directory: every tool the company uses.
create table tool (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  category    text,
  is_internal boolean not null default false,
  url         text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- Company terms and acronyms. Also feeds the AI.
create table glossary (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  term        text not null,
  definition  text not null,
  unique (company_id, term)
);


-- =============================================================
-- DOMAIN F  ·  Onboarding & lifecycle
-- =============================================================

-- A type of paperwork (contract, NDA, IP agreement...).
create table agreement (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  description text,
  document_url text,
  is_required boolean not null default true,
  unique (company_id, name)
);

-- A person's signature status for an agreement (the pre-work gate).
create table crew_agreement (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  agreement_id    uuid not null references agreement(id) on delete cascade,
  status          agreement_status not null default 'pending',
  signed_at       timestamptz,
  unique (crew_member_id, agreement_id)
);

-- Onboarding tracker: every new person always has a mentor.
create table onboarding (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  mentor_id       uuid references crew_member(id) on delete set null,
  status          onboarding_status not null default 'not_started',
  started_on      date,
  target_done_on  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (crew_member_id)
);

create table onboarding_step (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references company(id) on delete cascade,
  onboarding_id  uuid not null references onboarding(id) on delete cascade,
  label          text not null,
  is_done        boolean not null default false,
  sort_order     int not null default 0
);

-- A record of a role move (the redeployment SOP, made into data).
create table redeployment (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  from_role_id    uuid references role(id) on delete set null,
  to_role_id      uuid references role(id) on delete set null,
  move_type       redeploy_type   not null default 'trial',
  status          redeploy_status not null default 'proposed',
  mentor_id       uuid references crew_member(id) on delete set null,
  started_on      date,
  review_on       date,
  decided_on      date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- =============================================================
-- DOMAIN G  ·  Community  (the Vault & Spotlight)
-- =============================================================

-- A Vault post: ideas, quotes, inspiration, sources, shared projects.
create table vault_post (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  author_id   uuid references crew_member(id) on delete set null,
  kind        vault_kind not null,
  title       text not null,
  body        text,
  link_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table vault_vote (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  post_id         uuid not null references vault_post(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  vote            vote_type not null,
  created_at      timestamptz not null default now(),
  unique (post_id, crew_member_id)
);

create table vault_comment (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  post_id     uuid not null references vault_post(id) on delete cascade,
  author_id   uuid references crew_member(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Highlight a person to the whole company for a period.
create table spotlight (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  crew_member_id  uuid not null references crew_member(id) on delete cascade,
  reason          text,
  period_start    date not null,
  period_end      date not null,
  created_by      uuid references crew_member(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (period_end >= period_start)
);


-- =============================================================
-- DOMAIN H  ·  System
-- =============================================================

-- Audit log: who changed what. Essential with rotating people.
create table activity_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company(id) on delete cascade,
  actor_id     uuid references crew_member(id) on delete set null,
  action       text not null,            -- created, updated, redeployed...
  entity_type  text not null,            -- task, handoff, project...
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);


-- =============================================================
-- VIEWS  ·  the numbers the dashboards read
-- =============================================================

-- Per-person allocation total. Anything over 100 is an overload flag.
create view crew_workload as
select
  cm.id            as crew_member_id,
  cm.company_id,
  cm.full_name,
  coalesce(sum(a.allocation_pct), 0) as total_allocation_pct,
  coalesce(sum(a.allocation_pct), 0) > 100 as is_overloaded
from crew_member cm
left join allocation a on a.crew_member_id = cm.id
group by cm.id;

-- Per-role capacity: demand summed across all projects vs current headcount.
create view role_capacity as
select
  r.id          as role_id,
  r.company_id,
  r.name,
  coalesce(sum(rd.headcount_min), 0) as demand_min,
  coalesce(sum(rd.headcount_max), 0) as demand_max,
  (select count(*) from crew_member cm
     where cm.primary_role_id = r.id
       and cm.lifecycle_status in ('onboarding', 'active')) as current_headcount
from role r
left join role_demand rd on rd.role_id = r.id
group by r.id;

-- Contribution log: derived from completed work, never stored.
-- Feeds each person's exit artifact.
create view contribution_log as
select
  t.assignee_id   as crew_member_id,
  t.company_id,
  t.id            as task_id,
  t.title,
  p.name          as project_name,
  t.updated_at    as completed_at
from task t
join project p on p.id = t.project_id
where t.status = 'done' and t.assignee_id is not null;


-- =============================================================
-- TRIGGERS
-- =============================================================

-- Keep updated_at fresh on every table that has the column.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$I
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- Definition of Done gate: a task cannot be marked done unless it has
-- at least one complete handoff doc. This is the rule, enforced in the DB.
create or replace function enforce_handoff_on_done()
returns trigger as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    if not exists (
      select 1 from handoff h
      where h.task_id = new.id and h.is_complete
    ) then
      raise exception
        'Task % cannot be marked done: it has no complete handoff doc', new.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_task_definition_of_done
  before update on task
  for each row execute function enforce_handoff_on_done();


-- =============================================================
-- ROW-LEVEL SECURITY  ·  tenant isolation
-- =============================================================
-- The app sets the tenant per request, e.g.:
--   set_config('app.current_company_id', '<uuid>', false)
-- Then every query is automatically scoped to that company. One rule,
-- enforced everywhere, so no query can ever leak across companies.

-- Apply company isolation to every table that has a company_id column.
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'company_id'
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (
         company_id = current_setting(''app.current_company_id'', true)::uuid
       )', t);
  end loop;
end $$;

-- The company table itself is filtered by its own id.
alter table company enable row level security;
create policy tenant_isolation_company on company using (
  id = current_setting('app.current_company_id', true)::uuid
);

-- Example of finer control: milestone timeline visibility.
-- 'project_wide' is visible to anyone allocated to the project;
-- 'leads_only' to leads and admins; 'custom' to listed viewers.
-- Set the current crew member per request via app.current_crew_id.
create policy milestone_visibility_rule on milestone using (
  company_id = current_setting('app.current_company_id', true)::uuid
  and (
    visibility = 'project_wide'
    and exists (
      select 1 from allocation a
      where a.project_id = milestone.project_id
        and a.crew_member_id = current_setting('app.current_crew_id', true)::uuid
    )
    or visibility = 'leads_only'
    and exists (
      select 1 from crew_member cm
      where cm.id = current_setting('app.current_crew_id', true)::uuid
        and cm.access_tier in ('admin', 'lead')
    )
    or visibility = 'custom'
    and exists (
      select 1 from milestone_access ma
      where ma.milestone_id = milestone.id
        and ma.crew_member_id = current_setting('app.current_crew_id', true)::uuid
    )
  )
);


-- =============================================================
-- INDEXES  ·  Postgres does not auto-index foreign keys
-- =============================================================

create index idx_crew_member_company   on crew_member(company_id);
create index idx_crew_member_role      on crew_member(primary_role_id);
create index idx_crew_skill_member     on crew_skill(crew_member_id);
create index idx_role_company          on role(company_id);
create index idx_project_company       on project(company_id);
create index idx_allocation_member     on allocation(crew_member_id);
create index idx_allocation_project    on allocation(project_id);
create index idx_role_demand_project   on role_demand(project_id);
create index idx_task_company          on task(company_id);
create index idx_task_project          on task(project_id);
create index idx_task_assignee         on task(assignee_id);
create index idx_task_status           on task(status);
create index idx_handoff_task          on handoff(task_id);
create index idx_milestone_project     on milestone(project_id);
create index idx_knowledge_doc_company on knowledge_doc(company_id);
create index idx_knowledge_doc_project on knowledge_doc(project_id);
create index idx_meeting_company       on meeting(company_id);
create index idx_redeployment_member   on redeployment(crew_member_id);
create index idx_vault_post_company    on vault_post(company_id);
create index idx_vault_vote_post       on vault_vote(post_id);
create index idx_activity_log_company  on activity_log(company_id);
create index idx_activity_log_entity   on activity_log(entity_type, entity_id);

-- =============================================================
-- end of schema
-- =============================================================
