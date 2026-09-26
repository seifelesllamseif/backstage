# Deploying Backstage

One click gets you a live Backstage tied to a fresh Supabase project.

## One-click: Vercel + Supabase

Use the Deploy button in the repo README, or paste this URL:

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fseifelesllamseif%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_APP_NAME&envDescription=Your%20app%20name%20(e.g.%20Backstage).%20Everything%20else%20is%20configured%20post-deploy.
```

What happens when you click:

1. Vercel clones the repo into your account.
2. The Supabase integration (`integration-ids=oac_...`) opens a modal
   to create a new Supabase project.
3. Supabase auto-writes `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
   the `POSTGRES_URL` family into your Vercel env vars.
4. You type your app name.
5. Vercel builds. The build step (`scripts/migrate.mjs`) applies every
   SQL file in `supabase/migrations/` against the fresh database, then
   `next build` runs.

## After deploy

Open your Vercel URL. With an empty database you land on `/setup`:
one form creates your workspace and admin account. Complete it right
after deploying — the page locks itself permanently once the first
workspace exists. Log in, and the First-Run Wizard prompts you to pick
Solo / Small team / Full to bulk-enable modules.

No CLI, no SQL editor, no manual seeding.

Migrations re-run on every deploy but are recorded in
`supabase_migrations.schema_migrations` (the same table the Supabase
CLI uses), so already-applied files are skipped and `supabase db push`
stays interchangeable with the build-time runner.

## Updating

A one-click deploy is a copy of this repo taken the moment you clicked.
Fixes made here after that don't reach it on their own. This is how they do.

### What you'll see

Admins get a card in the bottom-left of the dashboard when a new release is
out. **Update available** can be dismissed until the next release. **Update
required** can't: it means your version is below the oldest one still
considered safe (for example, a security fix shipped since). The card's
button opens the updater in your own repo.

### Running the updater

Your repo includes `.github/workflows/update-from-upstream.yml`. It runs every
Monday, or on demand from **Actions → Update from upstream → Run workflow**.

1. It opens a pull request, `backstage-update`, with everything that changed
   upstream since your last update. Your own edits are kept. If you and
   upstream changed the same lines, it stops and lists the files instead of
   guessing.
2. Vercel builds a preview of that branch. Preview builds **don't** run
   database migrations, so your live data is untouched until you merge. A
   release that adds tables may show errors in the preview; that's expected.
3. Merge it. Vercel deploys to production, and the build applies any new
   migrations first, in order, even if you're several releases behind.

One-time setting, so the updater can open the pull request itself:
**Settings → Actions → General → Allow GitHub Actions to create and approve
pull requests.** Without it, you get an issue linking to the pull request
instead.

### Deployed before version 0.2.0

Check `version` in your repo's `package.json`. If it says `0.1.0`, your copy
predates the updater and needs a one-time setup. If you deployed before
13 Sep 2026 it also has a security problem: six tables
(`comment_reactions`, `task_reactions`, `onboarding_step_completions`,
`onboarding_step_templates`, `polls`, `poll_votes`) accept reads and writes
from anyone holding your public anon key. Update now:

1. In your GitHub repo: **Add file → Create new file**, name it
   `.github/workflows/update-from-upstream.yml`, and paste in
   [this file](https://raw.githubusercontent.com/seifelesllamseif/backstage/main/.github/workflows/update-from-upstream.yml).
   Commit it to your main branch.
2. Allow Actions to open pull requests (the setting above).
3. **Actions → Update from upstream → Run workflow**, then merge the pull
   request it opens.

A Vercel copy shares no git history with this repo. The updater works out
which commit you were copied from on its own. If it reports it can't, run it
again with **base** set to `331fe494d2a637333adf90a9f4789ee7bea79cfe`
(v0.1.0).

### Settings

- `MIGRATE_ON_PREVIEW=1`: also migrate on preview builds. Only set this if
  your previews use a separate database. By default Preview and Production
  share one.
- `BACKSTAGE_RELEASE_URL`: where the dashboard checks for releases. Set it to
  an empty string to turn the check off, e.g. for a fork you maintain
  yourself.

### Releasing (maintainers)

1. Bump `version` in `package.json`.
2. In `release.json`, set `latest`. If the release fixes something a
   deployment must not keep running, also raise `minSupported` to it and
   say why in `reason`. That turns everyone below it red.
3. Merge to main and tag `vX.Y.Z`.

Migrations have to be forward-only and safe to apply to a database that's
several releases behind, because that's exactly what an update does.

## Installing plugins

The catalog is served by the public marketplace site
([backstage-marketplace.vercel.app](https://backstage-marketplace.vercel.app))
— browse and vote on plugins there. Point a fork at your own catalog
with `MARKETPLACE_REGISTRY_URL`; if the endpoint is unreachable the app
falls back to the bundled `marketplace/registry.json`.

Browse the in-app Marketplace (`/dashboard/marketplace`). Plugins that
ship with the repo (like Team Polls) just need an admin to click
Enable. Installing a third-party plugin means adding its code to your
deployment:

1. Copy its folder into `plugins/<id>/`.
2. Add one import line each in `plugins.config.ts` and
   `plugins.config.server.ts`.
3. Push. The build applies the plugin's migrations automatically; then
   enable it in the Marketplace.

Authoring your own: see `PLUGINS.md`.

## Optional integrations

- **Google Calendar / Meet**: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
  in Vercel env vars. Add the redirect URI (see `.env.example`) to your
  Google Cloud OAuth client. Connect from `/dashboard/settings` as an admin.
- **Outbound email**: set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
  Leave blank to silently no-op email notifications; push notifications
  still work.

## Local dev

```bash
pnpm install
cp .env.example .env.local
# fill in Supabase URL + keys, plus any optional integrations
pnpm dev
```

Supabase local stack is optional — you can point `.env.local` at a
remote scratch project instead.
