-- 0001 created these two without RLS while anon and authenticated hold
-- full CRUD grants, leaving them writable by anyone with the public anon
-- key. server.ts reaches both only through ctx.admin (service role, which
-- bypasses RLS), so enabling it with no policies costs the plugin nothing.
-- Lives here rather than in a core migration because these tables only
-- exist where the polls plugin is installed.

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
