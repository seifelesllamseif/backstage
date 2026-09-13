-- Four tables shipped without RLS while the anon and authenticated roles
-- hold full CRUD grants on them. The anon key is public (it ships in the
-- browser bundle as NEXT_PUBLIC_SUPABASE_ANON_KEY), so anyone loading the
-- site could read and write these directly. They are empty today only
-- because the features are not in use yet.
--
-- Safe to enable with no policies: every read and write goes through the
-- service-role admin client (supabase/dashboard/fetch.ts, mutations.ts and
-- onboarding.ts all use createAdminClient()), which bypasses RLS. Nothing
-- in the app reaches them as anon or authenticated.
--
-- No policies on purpose. Realtime subscribes to task_comments,
-- activity_logs and quick_room_presence only -- none of these four -- so
-- no authenticated-role read path exists to keep alive. Add a policy the
-- day one of them gains a realtime subscription or a direct client read,
-- following the company_id scoping in 20260704000000_multi_workspace.sql.

alter table public.comment_reactions enable row level security;
alter table public.onboarding_step_completions enable row level security;
alter table public.onboarding_step_templates enable row level security;
alter table public.task_reactions enable row level security;
