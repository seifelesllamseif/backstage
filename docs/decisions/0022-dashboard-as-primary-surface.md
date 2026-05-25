---
status: accepted
decided_on: 2026-05-25
---

# 0022 — `/dashboard` becomes the primary work surface

## Context

After slices 1 and 2 shipped, slice-3-intake (`docs/slice-3-intake.md`)
revealed that the app wasn't being used: 1 of 6 seeded accounts has
ever signed in, 0 tasks were created post-seed, at most 1 fresh
handoff. The original slice-3 plan was a capacity board, but writing
a capacity feature for a company that hasn't yet trusted the task
board is building on top of a feature nobody is using.

In parallel, a Linear-style `/dashboard` route landed
(commit `9636abf`) with its own `DashboardShell` chrome (sidebar,
topbar, task drawer, multi-project board) and most of the supporting
schema (priority, labels, refs, checklists, relations, cycles,
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

The global authenticated shell wrapper
(`components/app-shell/shell.tsx`) is removed entirely:
`DashboardShell` provides its own chrome, the `(profile)` route
group already has its own shell-less layout (decision 0021), and
nothing else needs the old sidebar. `(authenticated)/layout.tsx`
collapses to a `verifySession()` + `children` passthrough.

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

- `components/app-shell/` (sidebar, shell, related primitives) is
  deleted entirely. shadcn sidebar primitives in `components/ui/` are
  kept — they may be used elsewhere later.
- Slice-1 board components in `app/(authenticated)/projects/[id]/`
  (`status-select.tsx`, `task-panel.tsx`, `add-task-form.tsx`,
  and the bespoke `page.tsx`) are deleted. The `tasks/[taskId]/`
  edit page is retained.
- `lib/business-logic.ts::boardColumns` is unused after the refactor
  but kept for now; the dashboard uses its own `STATUSES` source of
  truth (`dashboard/_components/status.ts`). A later pass should
  unify these.
- The slice-2 `StatusChangeResult` type is now shared contract for
  status mutations across both routes — when 3b lands drag-and-drop,
  the gate check uses the same return shape.
