---
status: accepted
decided_on: 2026-05-23
---

# 0013 — Step 5: CRUD-first, UI/validation polish deferred

## Context

Slice-1 step 5 ("Project board — write") adds task create, edit, and status-change. The plan §5.4 also calls for project archive. The user asked to prioritize backend/CRUD now and defer UI fidelity + friendly validation messaging to a later pass that references the `/backstage` Claude Design bundle.

This decision codifies that split for step 5 so future-me doesn't re-litigate it.

## Decision

### Backend scope (full coverage now)

- `createTask` — given a project, create a task with title, optional description, status (defaults to `backlog`), optional assignee, optional due date, `createdBy = current member`.
- `updateTask` — partial update of title, description, status, assignee, due date. Used by the edit page.
- `updateTaskStatus` — narrow-scope variant used by the board's status `<select>`. Same authz, just one field. Separated so the client component has a tiny API surface.
- `archiveProject` — soft-archive (`isArchived = true`). Admin+lead gated, per the same `requireAccessTier` pattern as `createProject` (see [0011](0011-projects-step-patterns.md)).
- **No hard delete for tasks or projects in slice 1.** Tasks use `status = 'canceled'`. Projects use `is_archived = true`. Both are reversible.

### Authorization

- Create, update, updateStatus on tasks: **any signed-in team_member in the same company.** No tier gate. Slice 1 trusts the team; per-row gates land with RLS in slice 3+.
- Archive project: **admin + lead only.** Same gate as create.
- Every action validates `companyId` matches `getCurrentTeamMember().companyId` before any write. Targeting a UUID from another company gets a `notFound()`-equivalent response, never a successful write.

### Validation

Zod schemas exist for **type safety and crash prevention only**:

- Reject missing required fields (e.g. `title`).
- Reject obviously bad enum values.
- Reject negative-length strings.

What is **deliberately not done yet**:

- Per-field error messages with friendly wording.
- Cross-field validation (e.g. "due date must be after start date").
- Maximum-length truncation guards on description/title beyond Postgres-safe limits.

A single "Couldn't save — try again" surfaced to the user is enough for now. The full validation pass happens in step 7 with the design bundle in hand.

### UI scope (minimal scaffolding only)

- **Add-task form** on the board page: inline at the bottom, two fields (title + initial column select), one Create button. Plain inputs, no modal.
- **Status select** on each card: a tiny client component (`status-select.tsx`) that calls `updateTaskStatus` and revalidates the path. No optimistic update; the server round-trip is fine.
- **Edit link** on each card → `/projects/[id]/tasks/[taskId]`, a plain server-component page rendering a `edit-task-form.tsx` client form with all editable fields.
- **Archive button** in the board header (admin/lead only).
- **Drag-and-drop is out of scope** for slice 1. Plan §5.4 explicitly permits status-dropdown for slice 1; drag waits.

What is deliberately not done:

- The detail "panel" mentioned in plan §5.4. We use a separate page instead because it's simpler than a modal/slide-over and ports cleanly to a panel later if step 7 wants that shape.
- Pixel-matching the Claude Design bundle. Step 7 will reference `/backstage/project/project-task-panel.jsx` and friends to bring the visuals into alignment.

## Consequences

- **Three new server actions ship in step 5.** All called from server components or client components via Next.js's server actions binding. None of them need a route handler.
- **Edit page lives at a real URL.** Bookmarkable, shareable, easy to test via curl. If step 7 moves to a panel/modal, the URL can stay and become a deep-link entry point.
- **No optimistic UI in slice 1.** Server round-trip on every save. If perceived latency becomes a problem, step 7 adds optimistic state via React's `useOptimistic`.
- **Validation messages will look bad in slice 1.** That is on purpose. Reviewers seeing "Couldn't save — try again" should not file a bug; they should add the per-field UX in step 7.
