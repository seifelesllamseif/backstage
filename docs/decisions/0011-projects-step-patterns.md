---
status: accepted
decided_on: 2026-05-23
---

# 0011 — Projects step: authz, company scoping, archive default

## Context

Slice-1 step 3 ships the projects list + a create form. The plan §5.3 says "a simple list of projects. Create a project. Open one to its board." Three small patterns get locked in here because they'll repeat across every later list/create surface (tasks, handoffs, team profiles…).

## Decision

### 1. Authorization tier check lives in the server action

The user picked **admin + lead only** for project creation. Two-layer enforcement:

- **UI:** The list page only renders the create form when `member.accessTier` is `admin` or `lead`. Members see the list but no input.
- **Server:** The `createProject` server action calls a new `requireAccessTier(["admin", "lead"])` helper in `lib/dal.ts` *before* the Prisma insert. The helper redirects to `/cockpit` if the tier doesn't match. (Throwing surfaces an ugly Next.js error overlay in dev — redirecting is friendlier and consistent with how `verifySession` already handles auth failures.)

The UI hide is a UX nicety; the server check is the actual security boundary. A member could `curl` the form action directly with their own cookie — the server still says no.

### 2. Every read and write is scoped by the current user's company

`getCurrentTeamMember()` returns the team_member row, which carries `companyId`. Every query and insert in this step uses that value as the filter / required field:

```ts
const member = await getCurrentTeamMember();
const projects = await prisma.project.findMany({
  where: { companyId: member.companyId, isArchived: false },
  orderBy: [{ kind: "asc" }, { name: "asc" }],
});
```

This is multi-tenant-ready without going full RLS-policy in slice 1 (per [0008](0008-rls-baseline-without-policies.md)). When a second company actually arrives, the policy layer goes on top of this pattern, not in place of it.

### 3. Archived projects are hidden by default

`where.isArchived = false` is in every list query. No "show archived" toggle yet — slice 1 doesn't need it. A future archive view (separate page or a query param) lands when there are projects to archive in real life.

### Sort order

Projects sort `kind asc, name asc`. Postgres orders the enum by declaration order, so `operations` actually comes after `standard` alphabetically — but for slice 1's two seeded projects ("Operations" and "Pilot Episode") the visible result is "Operations" on top because of the kind grouping. If a future slice wants a deterministic "Operations first" rule, we'll switch to a manual `ORDER BY CASE WHEN kind = 'operations' THEN 0 ELSE 1 END, name`.

## Consequences

- **`requireAccessTier(allowed)` becomes a shared helper.** Future server actions (create task, edit task, etc.) call it with their own allowed lists. The pattern is established here; new actions don't need to reinvent the check.
- **`member.companyId` becomes the implicit tenant key everywhere.** This file is the place to point at if anyone asks "why does every query carry companyId."
- **Members can read all projects.** The plan doesn't restrict read access — only write. If slice 3+ wants project-level visibility (per-person allocation gates), it'll add a join clause on top of the scoping established here, not replace it.
- **Archived-project UX is a known gap.** When someone archives a project today, it just disappears from the list. The "Archived (5)" view comes later.
