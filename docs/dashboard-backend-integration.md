# Dashboard Backend Integration

Connect the frontend-only dashboard at `/dashboard` to the Supabase backend via Prisma, adding all missing schema (priority, labels, refs, checklists, relations, cycles, comments, activity).

---

## Phase 1 — Schema (Prisma migration + Supabase)

Add these to `prisma/schema.prisma` and run migration:

- **Enums:**
  - Add `duplicate` to existing `TaskStatus` enum
  - New `TaskPriority` enum: `urgent | high | medium | low | none`
  - New `RelationKind` enum: `blocked_by | blocks | parent | sub_issue | triage`
  - New `CycleStatus` enum: `completed | current | upcoming`

- **New columns on `Task`:**
  - `priority TaskPriority @default(none)`
  - `ref String?` — human-readable display ID (e.g. "SKAM-101")
  - `seqNumber Int?` — auto-incrementing per project for ref generation

- **New models:**
  - `Label` — id, companyId, name, color
  - `TaskLabel` — taskId, labelId (composite PK)
  - `TaskDependency` — id, companyId, taskId, dependsOnTaskId, kind (RelationKind)
  - `TaskChecklistItem` — id, taskId, text, isDone, sortOrder
  - `TaskComment` — id, companyId, taskId, authorId, body, mentions (String[]), createdAt
  - `ActivityLog` — id, companyId, actorId, action, entityType, entityId, metadata (Json?), createdAt
  - `Cycle` — id, companyId, projectId, number, name, status (CycleStatus), fromDate, toDate
  - `CycleTask` — cycleId, taskId (composite PK)

## Phase 2 — Data Layer (Server Actions)

Create `app/(authenticated)/dashboard/actions.ts`:

- `fetchDashboardData(projectId)` — tasks with relations, labels, checklists, assignees
- `createDashboardTask(...)` — creates task + generates ref
- `updateDashboardTaskStatus(taskId, status)`
- `updateDashboardTaskPriority(taskId, priority)`
- `updateDashboardTaskAssignee(taskId, assigneeId)`
- `addComment(taskId, body, mentions?)`
- `toggleChecklistItem(itemId, isDone)`
- `deleteDashboardTask(taskId)`
- `duplicateDashboardTask(taskId)`

Each mutation logs to `ActivityLog`.

## Phase 3 — Wire Dashboard to Backend

1. Convert `page.tsx` to server component that fetches initial data via Prisma
2. Pass data as props to `DashboardShell` (client component)
3. Replace hardcoded `BOARD_TASKS` / `TEAM` with real DB data
4. Replace `useState` mutations with server action calls (optimistic UI pattern)
5. Default view: **all projects' tasks**. Add a project filter dropdown in the Topbar/FilterPanel — selecting a project narrows the board; clearing it shows everything again
6. Map `crew_member` rows → `BoardAssignee` shape (initials, color derived from index, avatar_url)

## Phase 4 — Seed Data

Create `prisma/scripts/seed-dashboard.ts`:

- Seed labels: Series, Audio, Pre-production, Casting, Locations, Writing, Marketing, Design, Ops, Strategy
- Seed cycles matching the hardcoded CYCLES
- Migrate the 24 hardcoded BOARD_TASKS into real task rows with priority, labels, refs, checklists
- Seed task relations and cycle-task associations

## Phase 5 — Cleanup

- Remove `boardData.ts` (hardcoded data) once DB is wired
- Update `status.ts` types to import from Prisma-generated types or keep as shared constants
- Ensure the existing `/projects/[id]` board still works (the new columns are additive, no breaking changes)
- Update `lib/business-logic.ts` to include `duplicate` in task statuses

---

## Key Decisions

| Decision           | Choice                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| `duplicate` status | Added to DB enum                                                             |
| Dashboard scope    | **All projects by default**, with a project filter dropdown to narrow to one |
| Ref format         | `{PROJECT_PREFIX}-{seqNumber}` (e.g. SKAM-101)                               |
| Activity           | Logged server-side on every mutation                                         |
| Cycles             | Stored in DB, linked to tasks via join table                                 |
| Migration tool     | Prisma `migrate dev` (generates SQL, applied to Supabase)                    |

## Execution Order

1. Schema + migration (no frontend changes, purely additive)
2. Seed script (populate test data)
3. Server actions (data layer)
4. Wire `page.tsx` + `DashboardShell` to real data
5. Test end-to-end
