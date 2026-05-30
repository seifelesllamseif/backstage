---
status: accepted
decided_on: 2026-05-25
---

# 0022 — `/dashboard` becomes the primary work surface

## Context

After slices 1 and 2 shipped, the slice-3 intake (since deleted; see
git history) revealed that the app wasn't being used: 1 of 6 seeded accounts has
ever signed in, 0 tasks were created post-seed, at most 1 fresh
handoff. The original slice-3 plan was a capacity board, but writing
a capacity feature for a company that hasn't yet trusted the task
board is building on top of a feature nobody is using.

In parallel, a Linear-style `/dashboard` route landed
(commit `9636abf`) with its own `DashboardShell` chrome (sidebar,
topbar, task drawer, multi-project board) and most of the supporting
schema (priority, labels, refs, checklists, relations, sprints,
comments, activity). The user has stated they will use `/dashboard`
more than the existing per-project board at `/projects/[id]`.

This forces a decision: do we have two boards (slice-1 board at
`/projects/[id]` and the dashboard at `/dashboard`), or does one win?

## Decision

`/dashboard` becomes the primary work surface. `/projects/[id]` is
kept as a per-project deep link but refactored to render the same
`DashboardShell` with the project filter pre-pinned. The slice-1
board page (`projects/[id]/page.tsx` with the bespoke six-column
layout) is replaced; the slice-1 task-edit page at
`/projects/[id]/tasks/[taskId]` is retained for now because it's
where handoff editing lives (until 3b folds that into the drawer).

URL shape stays as-is — `?project=<uuid>` on `/dashboard`. No slug
migration this slice.

The full-bleed routes (`/dashboard` and `/projects/[id]`) move into a
new `(workspace)` route group with a shell-less layout
(`verifySession()` + children passthrough, mirroring the `(profile)`
pattern from decision 0021). The global `<Shell>` is kept and stays
wrapped around the routes that remain in the `(authenticated)` group
(`/cockpit`, `/projects` list). The previously-commented-out shell
wrapper from `components/app-shell/shell.tsx` is uncommented — that
was a transitional hack while `/dashboard` was the only consumer; now
that `/dashboard` lives in its own group, the global shell can serve
the routes that still need it.

A `/dashboard` link is added to the global `AppSidebar` so users on
`/cockpit` or `/projects` (list) can reach the primary surface
without typing the URL.

## Why this and not the alternatives

- **Redirect `/projects/[id]` to `/dashboard?project=<id>`.** Cheaper
  to implement but breaks any in-flight user mid-action with a 307,
  and ugly in the URL bar. Keeping the route alive with the same
  rendered output costs one extra `page.tsx`.
- **Hard delete `/projects/[id]`.** Breaks existing links and
  bookmarks. Low value.
- **Keep both boards with different UIs.** Two surfaces to polish,
  two implementations of every mutation, two chances to drift on
  the handoff gate. Net negative.

## Slice-2 invariant — the gate must travel

The slice-1 board enforced the handoff gate in
`/projects/[id]/actions.ts::updateTaskStatus` via `isHandoffComplete`
(decision 0015). The dashboard's `updateDashboardTaskStatus`
currently does **not** enforce the gate. Before the routing refactor
lands, the gate is ported into `updateDashboardTaskStatus` with the
same `StatusChangeResult` shape — same rule (Done requires complete
handoff), same return contract, same `taskUrl` to the slice-1 edit
page for filling the handoff. If the dashboard UI doesn't yet
surface the error well (no toasts until 3a step 5), the optimistic
update reverts on gate failure and the user sees the card snap back
— enough signal until toasts land.

This ordering matters: gate parity ships **before** the routing
refactor, so there's no window in which `/projects/[id]` (now
rendering the dashboard) could let a Done transition through that
slice-2 would have blocked.

## What this enables for the rest of slice 3

- Step 2 (this slice) refactors `/projects/[id]` to a thin wrapper.
- Step 3 wires comments into the dashboard drawer.
- Step 4 surfaces the activity log in the drawer.
- Step 5 adds toasts — at which point the gate's "Fill handoff →"
  link becomes a proper toast action.
- 3b polish (skeletons, dnd-kit, visual fixes) lands on a single
  board UI rather than two.

## Consequences

- `components/app-shell/` is kept (serves `/cockpit` and `/projects`
  list). Its `shell.tsx` is uncommented; `sidebar.tsx` gains a
  `/dashboard` nav item.
- Slice-1 board components moved to `(workspace)/projects/[id]/`
  (`status-select.tsx`, `task-panel.tsx`, `add-task-form.tsx`) are
  deleted — the new `page.tsx` renders `DashboardShell` and has no
  consumers for them. The `tasks/[taskId]/` edit page is retained
  and reverted from being a redirect (decision 0017 assumed the
  slide-over had a handoff editor; the dashboard drawer doesn't
  yet — 3b polish folds this in).
- `lib/business-logic.ts::boardColumns` is unused after the refactor
  but kept for now; the dashboard uses its own `STATUSES` source of
  truth (`dashboard/_components/status.ts`). A later pass should
  unify these.
- The slice-2 `StatusChangeResult` type is now shared contract for
  status mutations across both routes — when 3b lands drag-and-drop,
  the gate check uses the same return shape.
