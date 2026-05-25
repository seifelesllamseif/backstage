# Dashboard upgrade status

What we have vs. what's left, scored against the 45-section advice list.
Read top-to-bottom: it's ordered roughly by leverage.

---

## What's shipped (this session + earlier)

### Board & drag-and-drop
- `@dnd-kit/core` + `sortable` + `utilities` installed
- Drag between columns, drag within columns
- Floating drag preview (`<DragOverlay>`)
- Dashed drop slot that follows the cursor across columns
- Optimistic updates + rollback on failure
- `task.sort_order` column + migration; renumbered on each drop
- Slice-2 handoff gate enforced on drop-to-Done (rejection reverts + toast)
- Horizontal scroll shadow + clipped-column fix
- Selected-card ring when drawer is open
- Hover state on cards
- WIP limit (count goes red when over)

### Task drawer
- Status / priority / assignee dropdowns wired to server actions
- Comments tab — DB-backed read + write via `task_comment`
- Activity log — DB-backed read, written automatically on every mutation
- Relation badges on cards (blocks, parent, sub-issue, etc.)
- Checklist (existed; reads from DB)

### Feedback / UX polish
- `sonner` toasts — success / error / undo
  - Task created → green toast
  - Delete → toast with **Undo**
  - Gate rejection → red toast with **Fill handoff** action
- Skeleton `loading.tsx` for `/dashboard` and `/projects/[id]`
- Empty board column → dashed CTA "Click to add a task"
- Empty Updates page → bell icon + explanation
- Due-date chip color states (overdue / due-soon / normal)

### Backend / structure
- App Router with route groups: `(workspace)`, `(profile)`, `(authenticated)`
- Server Components for initial data, Server Actions for mutations
- Prisma schema for: Task, Label, TaskLabel, TaskComment, ActivityLog,
  TaskDependency, TaskChecklistItem, Cycle, CycleTask
- Optimistic UI on all board mutations
- Supabase Auth (existing); `verifySession()` on every authenticated route

---

## Partial — works but thin

| Area | Status |
|---|---|
| Comments | Plain text only. No edit/delete, rich text, mentions, reactions, files, edited label, author avatar. |
| Activity log | Writes events but doesn't capture old→new values; missing rename/archive/attach events. |
| Skeletons | Board only. Drawer, comments, projects page, settings still blank-flash. |
| Authz UI | Server checks exist (`access_tier`); UI doesn't yet hide admin-only actions consistently. |
| List & Timeline views | Components exist but no inline edit, bulk actions, drag-to-resize dates. |
| Mobile | Drawer is responsive; sidebar/topbar/board not really tuned for small screens. |

---

## What's next — ranked by leverage

These are the upgrades worth doing **before** anything else from the
original 45-section list. Ordered.

1. **Realtime sync** (advice §9) — Supabase Realtime on `task`, `task_comment`,
   `activity_log` scoped to `company_id`. Currently if two people are looking
   at the board, one move doesn't appear for the other until refresh.
   *Caveat: only useful once more than one person is actually logged in
   regularly (see `slice-3-intake.md` — that hasn't happened yet).*
2. **Drawer depth** (advice §3) — inline title edit, due-date picker,
   project selector, "open in full page" link, copy-link button.
3. **Auto-scroll on drag near board edges** (advice §1) — `@dnd-kit/auto-scroll`
   plugin. Small but missed every time someone drags from the leftmost to
   rightmost column.
4. **Keyboard drag** (advice §1, §33) — wire `KeyboardSensor` from dnd-kit.
   Accessibility win, ~10 lines.
5. **Comment count + activity count on cards** (advice §2) — small icon +
   number on the card metadata row. Data already exists.
6. **Notifications** (advice §18) — `notification` table, in-app bell,
   "you were mentioned" events. Pair with realtime so the bell badge updates
   without refresh.
7. **Command palette** (advice §31) — `cmdk`. Cheap to add, high perceived
   value once people are using the app daily.
8. **Saved filter views** (advice §13) — store filter state per user; URL
   already drives filters, just needs persistence.
9. **Attachments** (advice §25) — Supabase Storage bucket scoped by
   `company_id`. Drag a file into the drawer, paste images.
10. **Soft-delete + archive flow** (advice §41) — current `deleteTask` is a
    hard delete with toast-undo. Should be a `deleted_at` flip with a
    proper Archive view.

---

## Deliberately NOT building (wrong for Backstage)

These look reasonable in a generic Linear/Notion-clone plan but conflict
with decisions already in `docs/decisions/`:

| Advice section | Why we won't | Reference |
|---|---|---|
| §10 — `workspaces` / `workspace_members` / `profiles` schema | Backstage is single-tenant; we have `company` / `crew_member`. A refactor would invalidate decisions 0002, 0004, 0015. | decisions 0002, 0004 |
| §10 — `task_assignees` many-to-many | Slice-2 handoff gate assumes one owner per task (handoff has one "from", one "to"). | decision 0015 |
| §10 — `statuses` as a customizable table | `TaskStatus` enum is wired into the handoff state machine. Custom per-workspace statuses break the Done gate. | decision 0015 |
| §11, §27 — `owner / admin / member / viewer` roles | We have `access_tier { admin, lead, member }`. Tier names are different on purpose. | slice-1 plan §4 |
| §1 — Collapsed columns / multiple assignees / watchers | Adds surface area without addressing why people aren't using the app yet. | slice-3-intake |
| §26, §29 — Workspace switcher / multi-workspace | Single company. | decisions 0002, 0016 |

---

## What the data still says

`slice-3-intake.md`: **1 of 6 accounts has ever signed in. 0 tasks created
post-seed. At most 1 fresh handoff.** The pivot we made (decision 0022 —
`/dashboard` as primary surface) is the bet that better daily-driver UX
will pull people in. If after a usage week the numbers don't move, the
honest read is: features aren't the bottleneck, and items 1–10 above
don't matter yet.

Re-read the intake doc before starting any of the "next" items.

---

## Quick reference

- All decisions: `docs/decisions/`
- Slice 3 plan (in progress): `docs/slice-3-plan.md`
- Slice 3 pivot: `docs/decisions/0022-dashboard-as-primary-surface.md`
- Schema: `prisma/schema.prisma`
- Dashboard code: `app/(workspace)/dashboard/`
- Server actions: `app/(workspace)/dashboard/actions.ts`
