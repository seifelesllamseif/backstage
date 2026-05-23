# Vercel deploy — slice 1

Run through this once, then forget about it for the week. The point is to
make the test honest: people use the app because it's *there*, not because
they remembered your laptop was on.

## Prereqs

- Empty GitHub repo for this code (local repo has no remote yet).
- Vercel account linked to the same GitHub identity.
- Supabase project `myncqewjjoqkjdlsuuqg` ("backstage") already running.

## Steps

### 1. Push to GitHub

```bash
git remote add origin git@github.com:<you>/backstage.git
git push -u origin main
```

### 2. Import into Vercel

[vercel.com](https://vercel.com) → **Add New… → Project** → pick the repo. Framework auto-detects as Next.js. Leave defaults.

### 3. Set environment variables

**Project settings → Environment Variables**. Add to **all three scopes** (Production, Preview, Development) unless noted:

| Name | Value |
|---|---|
| `DATABASE_URL` | Same Supabase **session pooler** URL from `.env.local` (port 5432, host `aws-1-eu-west-2.pooler.supabase.com`, user `postgres.myncqewjjoqkjdlsuuqg`). |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://myncqewjjoqkjdlsuuqg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_E9IZhIRWJQOzdyJzlIFmUQ_H4ieIRU9` |
| `NEXT_PUBLIC_SITE_URL` | Set after first deploy — Vercel will give you the URL. Use the production URL here. |

**Skip** `SUPABASE_SERVICE_ROLE_KEY` — it's only needed for `pnpm db:seed`, which doesn't run on Vercel. Keep it on your laptop only.

### 4. First deploy

Vercel auto-builds on push to `main`. First build is a few minutes.

If the build fails with `Cannot find module '.prisma/client'`, add a postinstall hook so `prisma generate` runs during install:

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

If it fails with `DATABASE_URL is not set` during build, the env var isn't visible to the Production build — re-check step 3 and confirm the var is enabled for the Production scope.

### 5. Tell Supabase the new URL

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your Vercel production URL (e.g. `https://backstage-<hash>.vercel.app`).
- **Redirect URLs (allow list)**: add the same URL plus a wildcard for previews: `https://backstage-*.vercel.app`. Add your custom domain if/when one lands.

Otherwise sign-in works but Supabase will reject password-reset / magic-link redirects later.

### 6. Sanity check

Open the production URL → bounce to `/login` → sign in as `iman@skam.test` / `backstage-dev` → land on `/cockpit` with two open tasks visible.

That's the deploy done. Now go run real work through it.

## Notes

- The proxy (`proxy.ts`) runs on Vercel just like locally — no Edge-runtime quirks because it stays on the Node runtime by default in Next.js 16.
- The Postgres connection from Vercel to Supabase goes through the session pooler over IPv4. No add-on needed.
- The `ws` WebSocket polyfill is wired into `lib/supabase/server.ts` and `lib/supabase/proxy.ts`. It activates only when `globalThis.WebSocket` is undefined, so it's a no-op in environments that already provide one.
- If you point a custom domain at this later (`backstage.skam.<tld>`), repeat step 5 with the new URL and update `NEXT_PUBLIC_SITE_URL`.
