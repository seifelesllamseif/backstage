---
status: accepted
decided_on: 2026-05-26
---

# 0023 — Member-scoped dashboard (project-derived team, tasks, updates)

## Context

Until now, `/dashboard` showed non-admin members:

- **Team list (sidebar, pickers, mentions, filters)**: every TeamMember
  in the company.
- **Updates panel**: every activity row in the company.
- **Board**: every task in the company, narrowed *client-side* to those
  assigned to the current member.

This was fine while seed data was small and there was effectively one
project, but it leaks teammates and updates from projects the member has
nothing to do with — and inflates the assignee picker, the @mention
autocomplete, and the activity stream.

The schema has no `ProjectMember` table. Project membership today is
implicit: a person is "on" a project iff they have ≥1 task assigned in
it. We chose not to introduce a real membership table this slice — that
adds an assignment UI for admins and a migration, and the implicit model
already matches how the team works in practice.

## Decision

For non-admin members, `/dashboard` is scoped to **"my projects" =
the set of projects where the member has ≥1 assigned task**. Concretely:

- **Tasks**: filtered server-side in `fetchDashboardData` to
  `projectId IN myProjectIds`. The board now shows all tasks in shared
  projects — not just the member's own. The "Mine" view (already in the
  sidebar) still narrows to assigneeId == me.
- **Team list**: scoped to distinct assignees on the visible tasks, plus
  the current member (so they always see themselves in pickers).
- **Projects (picker)**: scoped to `myProjectIds`. Members can't drill
  into a project they're not on; if the URL `?project=<id>` points at
  one, the scope locks to an empty set so they see nothing for it.
- **Sprints, comments, activity**: scoped to the same task/project set.

Admins are unchanged — they keep the full company view.

The previous client-side `visibleTasks` non-admin filter is removed
since the server now scopes correctly.

## Consequences

- A brand-new member with zero assigned tasks sees an empty dashboard
  until an admin assigns them their first task. This is intentional —
  it matches the implicit-membership model and avoids leaking projects.
- One write-side exception (added later for [[0025-bulk-task-creation-from-ai-paste]]):
  `fetchDashboardData` also returns `allActiveProjects` — the full
  company active-project list, *not* member-scoped. It's used **only**
  by the bulk-add picker in the New Task modal, where a member with no
  tasks yet still needs a target project to create *into*. Reads
  (board, breadcrumb, panels) stay scoped via the original `projects`
  field. The leak is mild — members learn project *names* exist but
  see no contents — and was the cleanest way to unblock the empty-
  member case without rewriting the membership model.
- The "project team" definition is purely derived. The day we add a
  real `ProjectMember` table, the derivation switches but the surfaces
  consuming `members` (sidebar, FilterPanel, TaskDetail, MentionInput,
  NewTaskModal via TeamContext) don't change.
- Activity log lookups now use `entityId IN (taskIds)`. The
  `(entityType, entityId)` index already exists; cheap at current scale.
