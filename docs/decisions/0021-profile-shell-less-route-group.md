---
status: accepted
decided_on: 2026-05-25
---

# 0021 — Shell-less route group for /profile

## Context

`app/(authenticated)/layout.tsx` wraps every nested route in `<Shell>` — persistent sidebar (`AppSidebar`) + top bar (`SidebarTrigger`) + content slot. That's the right chrome for the work surfaces (cockpit, projects, board), but the wrong chrome for `/profile/[slug]`. After decisions 0019 (visual idioms) and 0020 (per-member theme presets), the profile page is a personal full-bleed surface — sidebar from another visual language fights the bento and breaks the "this page is *this person*" intent.

The user request, verbatim: *"this page shouldn't show one"*.

Layouts in Next.js compose top-down — a nested `layout.tsx` *adds* to its parent, can't subtract. The canonical way to skip a parent layout for a subtree is **route groups** (parenthesized folder names that are ignored in URL construction).

## Decision

### Split

Two route groups, same auth posture, different chrome:

- **`app/(authenticated)/`** — has Shell. Houses cockpit, projects, board, task panel, and any future "work surface" routes.
- **`app/(profile)/`** — its own layout that calls `verifySession()` only. No Shell, no sidebar, no top bar. Houses `/profile` and `/profile/[slug]`.

URLs unchanged — `/profile`, `/profile/[slug]`, `/cockpit`, `/projects/...` all resolve as before. Route groups don't affect the URL path.

### `(profile)/layout.tsx` — slim auth-only wrapper

```tsx
import { verifySession } from "@/lib/dal";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  await verifySession();
  return <>{children}</>;
}
```

Identical security path to `(authenticated)/layout.tsx` (same `verifySession()` call). Difference: no Shell, no member fetch in the layout. The bento page already fetches `getCurrentCrewMember()` itself, so nothing is lost.

### Navigation exit affordance

Without a sidebar the user has no chrome to navigate away. Adding a small **floating back link** to the bento (top-left of the outer container, themed via `data-theme`):

```tsx
<Link
  href="/cockpit"
  className="absolute left-3 top-3 z-50 inline-flex items-center gap-1 rounded-md border border-border bg-card/70 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
>
  <ArrowLeft className="size-3" /> Cockpit
</Link>
```

Visible in both view and edit modes. Picks up the active theme through token inheritance.

### Files moved

```
app/(authenticated)/profile/page.tsx              → app/(profile)/profile/page.tsx
app/(authenticated)/profile/[slug]/page.tsx       → app/(profile)/profile/[slug]/page.tsx
app/(authenticated)/profile/[slug]/profile-bento.tsx → app/(profile)/profile/[slug]/profile-bento.tsx
app/(authenticated)/profile/[slug]/actions.ts     → app/(profile)/profile/[slug]/actions.ts
```

Imports use absolute `@/…` paths — none need updating.

## Pattern for future routes

When adding a new authenticated route, choose the group by chrome:

| Surface type                              | Group                  | Examples                          |
| ----------------------------------------- | ---------------------- | --------------------------------- |
| Work / app chrome (sidebar + top bar)     | `(authenticated)`      | cockpit, projects, board, settings |
| Personal full-bleed (no chrome)           | `(profile)`            | profile, future "my space" pages   |

If a third chrome variant ever shows up (e.g., onboarding wizard with a progress bar and no nav), it becomes its own group, not a flag.

## Why not other approaches

- **Conditional Shell based on pathname** — layouts run server-side and don't have access to the current pathname cleanly. Would require a client component sniffing `usePathname()` and rendering Shell conditionally — adds a render boundary and a flash on navigation.
- **CSS-hide the sidebar on /profile** — sidebar still in the DOM (cost) and breaks responsive logic.
- **Move /profile out of any auth wrapper** — loses `verifySession()`, security regression.
- **Per-page metadata flag (`page.tsx exports hideShell = true`)** — Next.js doesn't support this pattern for layouts; you'd build it yourself, adding a custom wrapper that defeats the layout system.

## How this relates to 0017 / 0018 / 0019 / 0020

- **0017** (UI fidelity pass) defined the Shell + sidebar chrome for the work surfaces — that stays unchanged for `(authenticated)` routes.
- **0018** (profile bento + slug routing + inline edit) — routes are unchanged; only the parent group moves.
- **0019** (visual idioms) — the bento's full-bleed treatment finally fits because there's no sidebar competing with it.
- **0020** (theme presets) — the back-link uses the bento's `data-theme` so it picks up Paper/Mocha/Ocean automatically.

## Skipped (deliberately)

- **A nav drawer / hamburger on the profile** — fights the full-bleed intent. If users feel stranded with just the back link, return to this.
- **A "view someone else's profile" breadcrumb** — when you're viewing another member's profile (`/profile/<someone-else's-slug>`), the back link still goes to `/cockpit`. A "back to whoever-linked-me" breadcrumb is nice but needs referrer state we don't currently thread through.
- **Removing `verifySession()` to allow public profiles** — out of scope; profiles are company-internal per decision 0018.
