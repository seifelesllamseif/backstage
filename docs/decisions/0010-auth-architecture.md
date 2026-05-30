---
status: accepted
decided_on: 2026-05-23
---

# 0010 — Auth architecture for slice 1

## Context

Slice-1 plan §5.1 calls for "plain email login. On success, land on the Cockpit." Three sources informed this design:

1. **Supabase Next.js tutorial** (`https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs.md`) — current recommended pattern for `@supabase/ssr` in App Router projects.
2. **Next.js 16 docs** (`node_modules/next/dist/docs/01-app/02-guides/authentication.md` and `.../file-conventions/proxy.md`) — official guidance, which has shifted between Next 14 and Next 16.
3. **`@supabase/ssr` README** (`node_modules/@supabase/ssr/README.md`) — the `getSession`/`getUser`/`getClaims` distinction.

Three Next 16-specific things bit us as soon as we started:

- **`middleware.ts` is deprecated, renamed to `proxy.ts`.** Different file name, different runtime (Node, not Edge). `middleware.ts` still works but is Edge-only and meant for libraries that *require* the Edge runtime. Supabase's `@supabase/ssr` works in Node, so we use `proxy.ts`.
- **`getSession()` is unsafe for authorization.** The session is read from cookies and not verified; a malicious client can forge one with the anon key. Use `getClaims()` (validates the JWT, locally via JWKS or against the Auth server) for any decision that gates access.
- **Node 20 has no native WebSocket**, and `@supabase/realtime-js` throws on instantiation without one. Already worked around in `prisma/seed.ts` by passing `realtime.transport: ws`. Same pattern needed in any server-side `createClient` path that initializes the realtime client. `@supabase/ssr`'s `createServerClient` may or may not avoid this — we polyfill `globalThis.WebSocket` defensively in `lib/supabase/server.ts` and `lib/supabase/proxy.ts`.

## Decision

### File layout

```
proxy.ts                                 # Next.js 16 proxy file at repo root
lib/supabase/client.ts                   # createBrowserClient — for "use client" components
lib/supabase/server.ts                   # createServerClient bound to next/headers cookies — for server components
lib/supabase/proxy.ts                    # createServerClient bound to NextRequest/NextResponse cookies — used inside proxy.ts
lib/dal.ts                               # verifySession() + getCurrentTeamMember() — server-only, React-cached
app/login/page.tsx                       # login form (client component, useActionState)
app/login/actions.ts                     # signIn / signOut server actions
app/page.tsx                             # root redirect: → /login if unauth, → /cockpit if auth
app/(authenticated)/layout.tsx           # route-group layout: calls verifySession before rendering children
app/(authenticated)/cockpit/page.tsx     # minimal Cockpit stub for slice 1 step 2 — full UI lands in step 6
```

The `(authenticated)` route group's layout calls `verifySession()`. Any future protected route (e.g. `/projects`, `/projects/[id]`) is dropped inside the group and is automatically gated.

### Session verification: `getClaims()`, not `getSession()`

- The proxy refreshes tokens by calling `supabase.auth.getClaims()` once per navigation. If claims come back, cookies are passed through fresh; if not, the proxy lets the request continue and the layout decides what to do.
- The DAL's `verifySession()` also uses `getClaims()`. On null, it `redirect("/login")`.
- Server components that need the *user's domain row* call `getCurrentTeamMember()`, which composes `verifySession()` + a Prisma `teamMember.findUnique` by `id` (where `id` is the auth user id, per [0002](0002-supabase-prisma-boundary.md)).
- We never call `getSession()` for authorization. `getSession()` is reserved for places where we just need to know if a cookie exists, never to gate access.

### Route group gate, not proxy gate

The proxy's job is **session refresh**. Authorization (who can see what) lives in the `(authenticated)/layout.tsx` via the DAL, per the Next 16 auth guide:

> "Proxy should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source."

The proxy doesn't redirect unauthenticated users; the layout does. This is more robust because a user landing on a protected URL with a stale cookie is handled exactly once, at render time, with verified claims.

### Login UX scope

- Email + password only. No magic-link, no OAuth, no signup form. Slice 1 has six seeded users; new accounts are added by an admin path in a later slice.
- The login form is a client component using `useActionState(signIn, ...)`. The server action does `signInWithPassword`, then `redirect("/cockpit")`. On error, the action returns `{ error: string }` which the form renders inline.
- The logout control sits inside `(authenticated)/layout.tsx` (or the Cockpit header) and posts to a server action that calls `signOut()` and redirects to `/login`.

### Env var name

We keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the variable name (already in `.env.example` and `.env.local`) holding the modern publishable key. The variable name is conventional; the value is what matters. Renaming to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is a strictly cosmetic future move, not slice-1 work.

### WebSocket polyfill

Both `lib/supabase/server.ts` and `lib/supabase/proxy.ts` set `globalThis.WebSocket = ws` at module load. This is server-only code (`@supabase/ssr` is server-only by convention; we add `import "server-only"` in `lib/supabase/server.ts` to enforce). Browser code uses `lib/supabase/client.ts` which calls `createBrowserClient` — the browser already has WebSocket.

## Consequences

- **`proxy.ts` at repo root replaces the never-written `middleware.ts`.** Any future search results, blog posts, or tutorials that say "middleware.ts" for a Next 16 app need to be mentally translated.
- **The `(authenticated)` route group's layout is the security gate.** Adding a new protected page is "drop a file inside `app/(authenticated)/`" — no auth boilerplate per page.
- **Slice-1 step 6 (Cockpit) replaces the stub** at `app/(authenticated)/cockpit/page.tsx`. Step 2's stub just renders the verified user's name + a logout button to prove the round-trip works.
- **`getClaims()` is the public verification primitive.** If a later slice needs fresh user data (e.g. role changed mid-session), it can call `getUser()` for that one check, but the default everywhere else is `getClaims()`.
- **No Edge runtime in slice 1.** `@supabase/ssr` runs fine on Node, `proxy.ts` is Node by default. If we ever need Edge (e.g. for global low-latency redirects), we'd add a separate `middleware.ts` for that narrow path — proxy.ts stays as is.
- **The WebSocket polyfill is a known wart.** Tracked here so the next Node-bump conversation knows to revisit it.
