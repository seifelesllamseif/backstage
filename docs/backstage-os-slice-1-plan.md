# Crew OS — Slice 1 build plan

A build brief for the first shippable slice. Hand this to your coding agent.
The goal of Slice 1 is one thing: the team stops tracking work in WhatsApp.

> Stack: Next.js + Postgres via Prisma. Single company, under 50 users.
> Theme: SKAM dark (tokens at the end).
> Rule for the agent: build only what is in this file. Anything not listed
> here is a later slice. If a decision is not covered, pick the simplest
> option for a non-technical first-time user and leave a code comment.

---

## 1. What Slice 1 is

A working task tracker for one company, with projects and a personal home
screen. A real person can log in, see their tasks, and move them across a
board. That is the whole slice. No handoffs, no capacity, no AI yet.

When Slice 1 ships, this problem is solved: "work scattered across WhatsApp
with no single source of truth."

## 2. In scope

- Auth: email login, one company, session.
- Three roles: admin, lead, member. (Titles can come later; access tiers now.)
- Projects: create, list, archive. Including the standing "Operations" project.
- Tasks: create, edit, assign, set due date, move across statuses.
- Project board: the six-column board.
- Crew Cockpit: a person's home, showing their own tasks only.
- Seed data: one company, ~6 people, 2 projects, ~15 tasks, so it is testable.

## 3. Explicitly NOT in scope for Slice 1

Do not build these. They are later slices.

- Handoff docs and the Done gate (Slice 2)
- Crew profiles, allocation, capacity, the Crew Board (Slice 3)
- Onboarding tracker, knowledge base (Slice 4)
- Vault, Spotlight, AI assistant (Slice 5)
- The timeline / roadmap view
- Row-Level Security (single company for now; add when multi-tenant is real)
- Notifications, email digests, search
- The onboarding block and roadmap block on the Cockpit (show nothing there yet)

## 4. Database — Slice 1 tables only

Build these tables now. Use UUID primary keys, timestamptz, snake_case.
Put a `company_id` on every table from the start, even with one company.

- **company** — id, name, slug, created_at
- **crew_member** — id, company_id, email, full_name, avatar_initials,
  access_tier (admin | lead | member), created_at
  - access_tier is an enum. Titles and contract types come in Slice 3.
- **project** — id, company_id, name, kind (standard | operations),
  is_archived, created_at
- **task** — id, company_id, project_id, title, description, status,
  assignee_id (nullable, to crew_member), due_date (nullable), created_by,
  created_at, updated_at
  - status enum: backlog, unscoped, todo, in_progress, in_review, done, canceled

Foreign keys to set now so later slices do not need surgery: task.project_id,
task.assignee_id, everything's company_id. Decide them once, here.

## 5. Screens — Slice 1

### 5.1 Login
Plain email login. On success, land on the Cockpit.

### 5.2 Crew Cockpit (cut down)
The person's home. For Slice 1 it has only TWO blocks:

1. Header strip — avatar initials, name, access tier.
2. My tasks — the person's open tasks, newest-relevant first. Each row:
   status pill, task title, project tag, due date (red if overdue).
   A "View board" link opens that task's project board.

Do NOT build the onboarding, allocation, handoff, or roadmap blocks yet.
Leave room for them, but render nothing. The full Cockpit spec is a later
reference, not a Slice 1 target.

### 5.3 Projects list
A simple list of projects. Create a project. Open one to its board.

### 5.4 Project board
The six-column board: Backlog, Unscoped, To do, In progress, In review, Done.
- Cards show: task id, title, project-relative; assignee initials; due date.
- Create a task (defaults to Backlog or Unscoped).
- Open a task to a detail panel: edit title, description, assignee, due date,
  status.
- Move a task between columns (drag, or a status dropdown — dropdown is fine
  for Slice 1, drag can come later).

## 6. Build order inside Slice 1

Ship the read path before the write path. Each step should run before the
next begins.

1. Project setup, Prisma schema for the four tables, migration, seed script.
2. Auth + session. A person can log in and is identified.
3. Projects list + create. Read first, then the create form.
4. Project board — read only. Tasks render in the right columns.
5. Project board — write. Create task, edit task, change status.
6. Crew Cockpit — the two blocks, reading the same task data.
7. Polish: empty states, overdue styling, the SKAM dark theme.

## 7. States every screen must handle

- Empty: no projects, or a project with no tasks — a calm one-line message
  and a clear "create" action. Never a blank broken panel.
- Loading: a quiet skeleton.
- Error: plain language and a retry. Never a raw error string.
- Overdue: a task past its due date shows the date in red.

## 8. Test checklist — run after Slice 1

Slice 1 passes when all of these are true:

- [ ] A person can log in and lands on their Cockpit.
- [ ] The Cockpit shows only that person's tasks, no one else's.
- [ ] A new project can be created and appears in the list.
- [ ] A task can be created inside a project.
- [ ] A task can be assigned to a person and given a due date.
- [ ] A task moves across all six board columns and the change persists.
- [ ] An assigned task shows up on that person's Cockpit.
- [ ] An overdue task shows its due date in red on both board and Cockpit.
- [ ] Empty project and empty Cockpit show calm states, not broken layout.
- [ ] A second test person sees their own tasks, not the first person's.
- [ ] Logging out and back in keeps all data.

If all eleven pass, Slice 1 is shippable. Put real people on it before
starting Slice 2 — their complaints reorder the next slice.

## 9. Definition of shippable

Slice 1 is done when a real team member can run their actual work day on it
without opening WhatsApp to track a task. Not when it is pretty. Not when
every screen is built. When it is genuinely usable for that one job.

## 10. SKAM dark theme tokens

- Page background:        #0E0E10
- Card background:        #161618
- Raised / inset card:    #1A1A1C
- Border:                 #2A2A2E  (0.5px)
- Divider:                #232327
- Text primary:           #F2F2F0
- Text secondary:         #A8A8AE
- Text muted:             #8A8A90
- Text dim:               #5C5C62
- Accent (SKAM red):      #E24B4A
- Success:                #5DCAA5
- Warning:                #EF9F27
- Info:                   #85B7EB
- Card radius 12px. Inner radius 8px. Pills fully rounded. Gaps 8–12px.
- Sentence case everywhere. Two font weights: regular and medium.
- Red is for attention only — overdue dates, the person's identity.
  Never a default fill.

---

## Next slices (for context, do not build yet)

- Slice 2 — Handoffs: the handoff table, six-field doc, the Done gate.
- Slice 3 — People & capacity: crew profile, allocation, the Crew Board.
- Slice 4 — Onboarding & knowledge: tracker, agreements, the knowledge base.
- Slice 5 — Culture & AI: Vault, Spotlight, then the AI assistant last.

Each slice is a vertical: its tables + its screens + one usable workflow.
Do not start a slice until the previous one has real users on it.
