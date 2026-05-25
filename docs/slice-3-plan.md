# Backstage — Slice 3 build plan

> **The pivot.** The original Slice 3 was a capacity board. Slice-3-intake
> (`docs/slice-3-intake.md`) showed the data does not justify it: 1 of 6
> accounts has ever signed in, 0 tasks created post-seed, at most 1 fresh
> handoff. Building a capacity feature for a company that hasn't yet
> trusted the task board with real work is building on top of a feature
> nobody is using.
>
> Slice 3 is now: **make `/dashboard` the primary work surface so usage
> actually happens.** The recently-shipped Linear-style dashboard
> (commit `9636abf`) becomes the daily-driver board, and the supporting
> features that make a daily-driver feel real — comments, activity,
> handoff-gate parity, basic feedback — land with it.

---

## 1. What Slice 3 is

A `/dashboard` that the team can actually run their work day on. Slice
1 + 2 already shipped the data model (tasks, handoffs, the seven-field
Done gate) and the single-project board at `/projects/[id]`. Slice 3
turns the global multi-project dashboard into the surface people open
in the morning, while keeping `/projects/[id]` available as a
per-project deep link.

When Slice 3 ships, this problem is solved: **"the dashboard exists but
people don't open it because it's missing the things that make a board
useful day-to-day"** — specifically, handoff-gate enforcement,
conversation (comments), audit trail (activity log), and the small
feedback signals that tell you the app is working.

## 2. Routing decision (settled)

- `/dashboard` — primary surface. Global multi-project board with a
  `?project=<uuid>` filter. Has its own `DashboardShell` chrome.
- `/projects/[id]` — kept. Per-project deep link. Same board UI as
  `/dashboard` rendered with the project filter pre-pinned. Existing
  bookmarks keep working.
- `?project=<uuid>` URL shape is intentionally kept; no slug migration
  this slice.
- The global app shell wrapper in `components/app-shell/shell.tsx`
  (currently commented out) is dead — `/dashboard` provides its own
  chrome. Will be properly cleaned up in 3a step 1, not left as
  commented blocks.

## 3. In scope

Split into **3a** (CRUD / gate / comments — must land before any polish)
and **3b** (drag-and-drop + visual polish — lands after a usage week
on 3a).

### 3a — CRUD, handoff gate parity, comments, activity

1. **Routing + decision doc.** `docs/decisions/0022-dashboard-as-primary-
   surface.md` records the call. `/projects/[id]` is refactored to
   render the same dashboard components with the project filter
   pre-applied (one board UI to maintain). `components/app-shell/shell.tsx`
   commented blocks deleted; `(authenticated)/layout.tsx` no longer
   wraps in `<Shell>`.

2. **Handoff gate parity in `/dashboard/actions.ts`.** Any code path
   that moves a task into `done` — status dropdown, inline edit, drag
   (3b) — must call `isHandoffComplete` first and return the same
   `StatusChangeResult` shape (`{ ok: false, reason: 'handoff-incomplete',
   taskUrl }`) that the slice-2 `/projects/[id]/status-select.tsx` uses.
   The dashboard UI surfaces a "Fill handoff →" link on failure,
   identical to slice-2 behaviour. **Slice 2 invariant cannot regress.**

3. **Comments in the task drawer.** Tables already exist (`task_comment`
   from commit `9636abf`).
   - Read: drawer loads comments for the task, renders author + body +
     relative timestamp.
   - Write: plain `<textarea>` + server action. Inserts a `task_comment`
     row and a `activity_log` row in the same transaction.
   - Plain text only. No markdown, mentions, reactions, threads,
     attachments — those are explicitly later.

4. **Activity log in the task drawer.** Table exists (`activity_log`).
   - Read: drawer loads the activity feed for the task, renders one
     line per event ("Iman moved this from To do to In progress").
   - Write: server actions for status / assignee / due-date / priority
     changes write an `activity_log` row alongside the mutation.
     Comments also write a log row.
   - Tabs in the drawer: `[Comments] [Activity]`.

5. **Toasts on mutations.** Install `sonner`. Toast on: task created,
   status changed, comment posted, assignee changed, archived (with
   Undo), failed mutation. No toasts for every autosaved field — use
   inline "Saving…/Saved" for those.

### 3b — Drag-and-drop and visual polish (deferred to post-usage-week)

6. **Skeleton loading + empty states.** Skeletons for the board,
   drawer, comments list. Empty-state polish for `/dashboard/updates`
   and empty board columns (icon + explanation + primary CTA).

7. **Visual fixes.** Clipped column overflow (`flex gap-4 overflow-x-auto`
   container + horizontal scroll shadow), consistent drawer width
   (~520px desktop), "selected card" state when drawer is open, hover
   states on cards, drawer open/close transition, due-date chip with
   normal / due-soon / overdue color states (extending the
   `StatusPill` token pattern).

8. **Drag-and-drop with optimistic + gate routing.** `@dnd-kit/core`
   between columns and within a column. Card moves instantly on drop;
   server action runs through the Step 2 handoff gate; rollback +
   error toast on failure. Adds `task.sort_order` column (new
   migration) so within-column order persists. Auto-scroll near
   board edges. Keyboard drag for accessibility.

## 4. Explicitly NOT in scope for Slice 3

Do not build these. They are later slices, or never (the second list).

**Later slices:**
- Realtime Supabase sync (no second active user yet to sync with).
- Notifications / Updates inbox / mentions / presence / typing
  indicators.
- Command palette, saved views, list view, bulk actions.
- Attachments (Supabase Storage integration).
- Search beyond what's already there.
- Capacity / allocation / the Crew Board (original Slice 3 — defer
  indefinitely until usage data says it's wanted).

**Never (incompatible with Backstage):**
- Workspaces refactor (`workspaces` / `workspace_members` /
  `profiles` schema from the §10 advice). Conflicts with decisions
  0002, 0004, 0015, 0016. Backstage is single-tenant by design.
- Multiple assignees per task, watchers / followers. Breaks the
  handoff gate's single-owner assumption (slice-2 architecture).
- Per-workspace customizable statuses. Status enum is wired into the
  handoff state machine; renaming is fine, custom statuses break the
  gate.
- Role split into `owner / admin / member / viewer`. We have
  `access_tier { admin, lead, member }` — no change.
- WIP limits, custom workflows, timeline-with-drag-to-change-dates,
  analytics dashboards. Premature for a 6-person team and 15 tasks.

## 5. Database — Slice 3 changes

**3a:** No schema changes. Everything 3a needs is already in the
schema from commit `9636abf` (`task_comment`, `activity_log`).

**3b:** One migration only — `task.sort_order INTEGER` for the
within-column persistence required by drag-and-drop.

## 6. Acceptance — Slice 3a

A reviewer can verify by hand without running tests:

1. Visit `/dashboard`. Try to drag (well, change status of) a task to
   `done` whose handoff is incomplete. See an error with a "Fill
   handoff →" link, identical to `/projects/[id]`.
2. Visit `/projects/[id]` for an existing project. See the same board
   UI as `/dashboard`, pre-filtered to that project.
3. Open a task in the drawer. Post a comment. See it appear with your
   name, body, timestamp.
4. In the same drawer, change the assignee. See an activity row appear
   ("X assigned this to Y") alongside the comment in the Activity tab.
5. Status change, comment post, assignee change all show a toast.
   Archive shows a toast with an Undo action.
6. `components/app-shell/shell.tsx` no longer has commented-out
   `<SidebarProvider>` blocks.

## 7. Usage week (between 3a and 3b)

After 3a ships, **one week** of real use before starting 3b. Same
method as slice-1-usage-notes.md: active observation, daily closing
question, watch for what people actually hit. The polish work in 3b
is shaped by what 3a usage reveals — if the drawer is the wrong shape,
3b's drag-and-drop is premature.

## 8. Order of operations

3a (one PR per step, in this order):

1. Decision 0022 + routing consolidation + shell cleanup
2. Handoff gate parity on `/dashboard/actions.ts`
3. Comments — schema is ready, just wire UI + action
4. Activity log — schema is ready, write rows in all mutation actions
5. `sonner` install + toasts on mutations

Then: **usage week.**

Then 3b (one PR per step):

6. Skeletons + empty states
7. Visual fixes (CSS-only)
8. `@dnd-kit` install + drag-and-drop + `sort_order` migration

---

## 9. Open questions for the reviewer (me) to settle before 3b

These are deliberately not settled now. Answer after the usage week,
informed by what people actually hit:

- Did anyone use the comments? If no, 3b drops the comments polish.
- Did the activity feed feel useful or noisy?
- Did the existing two-board UI (one shared component, two routes) feel
  consistent, or does `/projects/[id]` need to be removed?
- Are toasts the right feedback shape, or do people miss them?
- Is the drawer the right primary edit surface, or do people want a
  full task page (`/tasks/[taskId]`)?
