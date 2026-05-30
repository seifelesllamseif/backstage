---
status: accepted
decided_on: 2026-05-23
---

# 0015 — Slice 2: handoff architecture (lazy, app-level gate, current-assignee scope)

## Context

Slice-2 plan ships the handoff doc plus the Definition-of-Done gate. The plan
(`docs/backstage-os-slice-2-plan.md` §4–§6) leaves four choices to the
implementer; recording them here so the next slice can stack on a known shape.

The plan itself flags it was written without slice-1 usage data — slice 2 is a
reasonable guess at the founding "inheriting work is a mess" pain. Slice 3 has
permission, in §11 of the plan, to ignore parts of this if real usage
contradicts them.

## Decision

### 1. Handoff rows are created lazily, not on task creation

A task gets a `handoff` row the **first time** someone opens the Handoff
section on the task detail panel. The Handoff section renders "Start
handoff" until then. Reasons:

- Most tasks (the ones in Backlog, Unscoped, even Todo) will never need a
  handoff. Auto-creating an empty row per task is N empty rows times the
  number of tasks the company never finishes.
- The plan §7 explicitly calls for the empty-handoff state to "offer to
  start one," which already implies lazy.
- The Cockpit "To fill" computation uses `task.assignee_id = me` + presence
  of a handoff row, so we don't need rows we never read.

A "Start handoff" action posts to `createHandoff(taskId)` which inserts
`{ task_id, company_id, status: 'in_progress' }` with all seven content
fields `NULL`. The page revalidates and the form replaces the button.

### 2. Anyone signed-in in the same company can edit a handoff

Same gate as slice-1 task editing — the trust model didn't change. The
server action verifies the handoff's `companyId` matches the caller's, and
that's it. If real usage shows someone editing a handoff they shouldn't,
slice 3+ can add a `locked_by` or "only assignee + admin/lead" gate.

### 3. Cockpit "To fill" = my-currently-assigned tasks with an incomplete handoff

Specifically:

```
where:
  task.companyId = me.companyId
  task.assigneeId = me.id
  task.status ∉ ('done', 'canceled')
  handoff IS NOT NULL                  -- a handoff row exists
  AND NOT all-seven-fields-filled      -- incomplete
```

"Received" is simpler — `handoff.to_member_id = me.id`. The plan listed
`from_member_id` as an alternative for "to fill" but slice 2 doesn't have a
UX surface that sets `from` explicitly yet, so leaning on it would surface
an empty list.

If a future slice adds explicit "I'm handing off to X" UX, we revisit.

### 4. `is_complete` is computed in TypeScript, not as a Postgres GENERATED column

The plan §4 explicitly permits "Application-level is enough for Slice 2; a
trigger can come later." Two TS surfaces enforce the rule:

- `lib/handoff.ts` exports `isHandoffComplete(handoff): boolean` — the
  single canonical check, used by the form's missing-field count, the Done
  gate, and the Cockpit query.
- `updateTaskStatus` and `updateTask` server actions: any transition
  targeting `status = 'done'` calls `isHandoffComplete` against the task's
  handoff row first. If false (or the row doesn't exist), they return
  `{ ok: false, reason: 'handoff-incomplete', missingCount, taskUrl }`
  instead of writing.

The board's `StatusSelect` and the edit page's status select both render
this calmly: a one-line message with a direct link to the handoff section,
naming how many fields are missing. No raw error strings; no silent
failure.

A DB-level `GENERATED ALWAYS AS` column or a `BEFORE UPDATE` trigger that
re-enforces the gate stays viable for a later slice — the same pattern as
the auth FK (`prisma/sql/team_member_auth_fk.sql`). For slice 2, the
app-level gate is what ships.

## Field shape

Seven nullable text fields on `handoff`, matching plan §6.1 labels:

| Prisma field | DB column | Form label | One-line hint |
|---|---|---|---|
| `whatItIs` | `what_it_is` | What it is | One or two lines: what the task is and why. |
| `currentStatus` | `current_status` | Current status | Where it stands now. |
| `doneSoFar` | `done_so_far` | Done so far | What is finished. |
| `stillLeft` | `still_left` | Still left | What remains. |
| `fileLinks` | `file_links` | Where the files are | Exact links or paths. |
| `gotchas` | `gotchas` | Gotchas | Anything non-obvious that would waste the next person's time. |
| `whoToAsk` | `who_to_ask` | Who to ask | One or two people who can unblock it. |

`is_complete` = all seven are non-null AND non-empty after `.trim()`.

`handoff.status` enum: `in_progress` (default), `blocked`, `ready_for_review`,
`done`. Manually set by the user via the form's status select. Independent
of `is_complete` — completion gates the *task's* status, the handoff's own
status is metadata about how the handoff itself is progressing.

## Seed strategy for slice 2

Two paths, depending on whether the dev DB has slice-1 data already:

- **Fresh DB** (`prisma migrate reset` + `pnpm db:seed`): the existing
  `prisma/seed.ts` is extended to insert handoff rows for two `done` tasks
  (complete) and two in-flight tasks (partial — three or five of seven
  filled). The remaining 11 tasks get no handoff.
- **Existing seeded DB** (slice-1 data still in there): a new script,
  `prisma/scripts/seed-slice-2-handoffs.ts`, looks up the four target tasks
  by title and inserts handoffs. Idempotent — if a handoff already exists
  for a task, it skips. Run via `pnpm tsx --env-file=.env.local
  prisma/scripts/seed-slice-2-handoffs.ts`.

## Consequences

- **Adding the Done gate later for tasks already in `done` status** is a
  non-issue. The gate fires on *transitions to* `done`, not on existing
  rows. Slice-1-seeded tasks already in `done` keep their state.
- **The `handoff.task_id` unique constraint** is set at the DB level so a
  task can have at most one handoff. If a future slice wants multiple
  handoffs per task (revisions, multiple owners), it's a migration plus a
  composite-key change — minimal surgery.
- **The board's `StatusSelect` becomes a real component**, not just a
  thin wrapper around `useTransition`. It needs to render an inline error
  and may benefit from a small toast or alert region. Slice 2 ships the
  inline error inside the card; toast can wait for the design-fidelity
  pass.
- **`updateTaskStatus` and `updateTask` return `Result` types now**, where
  before `updateTaskStatus` returned `void`. Anywhere they're called from
  needs to read the result.
