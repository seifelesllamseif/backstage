---
status: accepted
decided_on: 2026-05-23
---

# 0014 — Step 7 polish scope

## Context

Slice-1 plan §6 lists step 7 as "Polish: empty states, overdue styling, the SKAM dark theme." Plan §7 names the four states every screen must handle: empty, loading, error, overdue. Plan §10 specifies the SKAM dark theme tokens.

By the end of step 6, the app already had: overdue styling on both board and Cockpit, calm empty states on /projects and Cockpit my-tasks, and `notFound()` for bad IDs. What was missing: the theme tokens themselves (shadcn's default OKLCH neutrals were rendering everywhere), loading states (raw blank page while data fetched), and error boundaries (Next's default ugly stack trace).

The user's standing preference (memory: `feedback-crud-first-ui-later`) is to defer full UI fidelity to a separate UI-heavy pass that references `/backstage/project/*.jsx` for layout and component idioms. This step is the *foundation* for that pass, not the pass itself.

## Decision

### Three things ship in step 7

1. **SKAM theme tokens wired into Tailwind v4.** The hex values from plan §10 (and mirrored in `lib/business-logic.ts`'s `skamTheme`) become the CSS custom properties in `styles/globals.css`. The app runs in a single dark mode — no light/dark toggle, no `.dark` class flipping. Token mapping:

   | shadcn token | SKAM value | source |
   |---|---|---|
   | `--background` | `#0E0E10` | page |
   | `--foreground` | `#F2F2F0` | textPrimary |
   | `--card`, `--popover` | `#161618` | card |
   | `--secondary`, `--muted` | `#1A1A1C` | cardRaised |
   | `--muted-foreground` | `#A8A8AE` | textSecondary |
   | `--border`, `--input` | `#2A2A2E` | border |
   | `--accent`, `--accent-foreground` (bg/fg) | `#E24B4A` / `#F2F2F0` | accent |
   | `--destructive` | `#E24B4A` | accent (same — red-is-for-attention) |
   | `--ring` | `#E24B4A` | accent |
   | `--primary` | `#F2F2F0` | textPrimary (white-on-dark CTA) |

   Plus three SKAM-only colors exposed as Tailwind utilities via `@theme inline`: `text-success` (`#5DCAA5`), `text-warning` (`#EF9F27`), `text-info` (`#85B7EB`).

2. **`app/(authenticated)/loading.tsx`** — a quiet skeleton: a header bar and 5 row placeholders, all `animate-pulse bg-card`. Covers every protected route while data fetches. Next.js wires this up automatically when a server component suspends.

3. **`app/(authenticated)/error.tsx`** — a client component with plain language ("Something didn't load. Try again.") and a Try-again button that calls Next's `reset()`. Never renders the raw error message. The error boundary catches anything thrown inside the protected group.

### What is deliberately deferred

- **Per-route loading skeletons.** Slice 1 ships one generic skeleton for all protected routes. Per-page skeletons (a board with column placeholders, a cockpit with the right block sizes) land in the design-fidelity pass.
- **Component-level error boundaries.** A single `(authenticated)/error.tsx` is enough; surface-level boundaries inside the board / cockpit can wait.
- **Design fidelity to `/backstage/project/*.jsx`.** Those files use inline-styled prototypes with custom `PersonChip`, `FilterChip`, `Icon`, etc. Porting them is a separate pass that's about visual match, not feature parity. Step 7 sets up the tokens so that pass has somewhere to anchor.
- **The full Cockpit blocks** (onboarding tracker, allocation, handoffs, roadmap). Slice-1 plan §5.2 explicitly leaves them out. They land in slices 2–5.

## Consequences

- **Every screen turns dark immediately.** The change is global because the tokens are global. shadcn-generated components (button, etc.) pick up the SKAM palette without any per-component edits.
- **`bg-card`, `border-border`, `text-muted-foreground` etc. now mean SKAM colors.** Any code I wrote in steps 3–6 using those classes (a lot) starts looking right on the next render.
- **`text-destructive` is the red.** Overdue dates, the accent — same hex. This matches plan §10's "red is for attention only" discipline because nothing else uses red.
- **Empty states retain their slice-1 wording.** The "Nothing on your plate" / "No projects yet" / "Nothing here" copy stays — the design-fidelity pass can rephrase if needed.
- **No light-mode tokens.** If we ever want a light theme, we'll add a `.light` selector with a new token set; the slice-1 plan doesn't ask for it.
