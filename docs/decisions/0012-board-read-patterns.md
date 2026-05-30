---
status: accepted
decided_on: 2026-05-23
---

# 0012 — Board read patterns

## Context

Slice-1 step 4 is the project board, read-only. Plan §5.4: six columns — Backlog, Unscoped, To do, In progress, In review, Done — with cards showing task id (project-relative), title, assignee initials, and due date (red if overdue). Step 5 adds write (create, edit, move); we're not there yet.

Three small calls that affect every later board change.

## Decision

### Column set: the six statuses on the board; `canceled` is hidden

The `task_status` enum has seven values; the plan's board has six. `canceled` is a side-state — useful for the schema (you can mark a task as canceled instead of deleting it), but not a column anyone wants to look at. It's filtered out of the board entirely. A separate "canceled" list can land later when there's a reason to look at one (audit, reopen).

### Sort within each column: due-date asc, nulls last; tiebreak created_at asc

```ts
orderBy: [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
]
```

Things due sooner sit on top of their column. Undated tasks fall to the bottom. Predictable; no surprise reorderings. Slice 7 polish can refine if the team wants something else.

### Card content for slice 1

Each card shows:

- **Title** (full, wrapped, no truncation in slice 1).
- **Assignee initials** in a small chip (or em-dash if unassigned). The `team_member.avatar_initials` column already carries this; no derive-on-the-fly logic.
- **Due date**, formatted via `date-fns` as `MMM d` (e.g. "May 27"). Red text if past today's date, default text otherwise. No "in 3d" or "Mon" relative phrasing for slice 1 — straight date.

What's **not** on the card for slice 1:

- A **project-relative task id** ("PE-23" style). The plan mentions this, but the schema has no per-project counter — `task.id` is a UUID. Adding `project_task_number` is a migration we can defer to step 5 or a later slice. Slice-1 acceptance (plan §8) doesn't depend on the id; we render the UUID nowhere.
- Description, labels, dependencies — those are slice 2+.

### Mobile / narrow-viewport: horizontal scroll

Six columns side-by-side won't fit on a phone. We make the board container `overflow-x-auto` with fixed-min-width columns; mobile users scroll horizontally. Stacking columns vertically would change the UX too much for too little benefit at slice 1 — boards are inherently horizontal.

### Access control

Anyone in the user's company can read any of that company's boards. The page query asserts `project.companyId === member.companyId` and 404s otherwise (via `notFound()`). No per-project read gates in slice 1 — Plan §3 says RLS / per-row visibility is deferred.

## Consequences

- **Adding the seventh column (canceled view) is additive**, not a refactor. Future slices that need to surface canceled work add a separate view or a "Show canceled" toggle.
- **The card layout is a component, even though it's inlined.** When step 5 adds click-to-open, the same JSX renders inside a `<Link>` or button wrapper. Keeping it lightweight now avoids a refactor.
- **`avatar_initials` is the only display field for assignees on the board.** If a future slice wants real avatar images, that's an `avatar_url` migration (currently absent — slice-1 plan §4 chose initials over URL). The board code reads whichever field exists.
- **The "Operations" project's board renders identically to a standard project's.** Slice-1 doesn't differentiate visually; later slices (e.g. when operations gets recurring tasks) may add an Operations-specific row treatment.
