---
status: accepted
decided_on: 2026-05-23
---

# 0004 — Prisma schema scope (slice-1 plan wins)

## Context

Two specs describe the database, and they disagree:

- `docs/backstage-os-slice-1-plan.md` §4 — a minimal four-table cut sized to ship slice 1.
- `docs/crew-os-schema.sql` — the eventual full schema, ~30 tables, dozens of fields per table.

Examples of disagreement: the plan calls for `crew_member.avatar_initials` (a tiny string for the UI's circle badge); the SQL has `avatar_url`. The plan's `crew_member` has 7 columns; the SQL's has ~14. Modeling everything now means slice 1 ships with unused columns and the plan/code drift further.

## Decision

For now, **the slice-1 plan §4 is the source of truth for what gets modeled in `prisma/schema.prisma`.** The SQL schema is a forward reference for later slices.

Concretely:
- Only the four slice-1 tables exist in Prisma: `company`, `crew_member`, `project`, `task`.
- Only the columns explicitly listed in plan §4 exist in each model. No future fields, even nullable.
- Where the two specs disagree on a field name (`avatar_initials` vs `avatar_url`), the plan wins. Slice 3 can rename or add columns via a migration when it actually needs the larger profile.
- Enums modeled now: `access_tier` (admin, lead, member), `project_kind` (standard, operations), `task_status` (the seven the board uses).
- Foreign keys named in plan §4 are set now so later slices don't need surgery: `task.project_id`, `task.assignee_id`, every domain table's `company_id`. See the FK column-by-column table below.

### Slice-1 column inventory

| Table | Columns |
|---|---|
| `company` | `id`, `name`, `slug` (unique), `created_at` |
| `crew_member` | `id`, `company_id`, `email`, `full_name`, `avatar_initials`, `access_tier`, `created_at`. Unique `(company_id, email)`. |
| `project` | `id`, `company_id`, `name`, `kind`, `is_archived`, `created_at`. Unique `(company_id, name)`. |
| `task` | `id`, `company_id`, `project_id`, `title`, `description`, `status`, `assignee_id` (nullable), `due_date` (nullable), `created_by` (nullable per FK), `created_at`, `updated_at` |

### FK behavior (matches `crew-os-schema.sql`)

| FK | On delete |
|---|---|
| `crew_member.company_id` → `company.id` | cascade |
| `project.company_id` → `company.id` | cascade |
| `task.company_id` → `company.id` | cascade |
| `task.project_id` → `project.id` | cascade |
| `task.assignee_id` → `crew_member.id` | set null |
| `task.created_by` → `crew_member.id` | set null |
| `crew_member.id` → `auth.users.id` | cascade (hand-written; see [0002](0002-supabase-prisma-boundary.md)) |

## Consequences

- The Prisma schema is leaner than the SQL schema on day one. Future slices add fields/tables via migrations — that's the normal Prisma flow, not a problem.
- `Task` is the only slice-1 table with `updated_at` (per the plan). Other tables get it when a slice actually needs to track edits.
- `gen_random_uuid()` (pgcrypto) is used as the default for `company.id`, `project.id`, `task.id` — matches the SQL schema. `crew_member.id` has **no default**: its value comes from Supabase Auth per [0002](0002-supabase-prisma-boundary.md).
