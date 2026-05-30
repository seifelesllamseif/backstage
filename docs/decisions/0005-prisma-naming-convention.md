---
status: accepted
decided_on: 2026-05-23
---

# 0005 — Prisma naming: camelCase models, snake_case DB

## Context

The SQL schema (`docs/backstage-schema.sql`) uses snake_case for everything (`team_member`, `full_name`, `due_date`). The slice-1 plan used the same convention. Application code is TypeScript, where snake_case identifiers are non-idiomatic and slow to read.

Prisma supports two patterns:

1. snake_case models in `schema.prisma` → app code calls `prisma.team_member.findMany()` and reads `task.due_date`.
2. camelCase models in `schema.prisma` with `@map`/`@@map` directives that tell Prisma the DB column is snake_case → app code calls `prisma.teamMember.findMany()` and reads `task.dueDate`, but the actual DB stays snake_case.

## Decision

**Use camelCase Prisma models with `@map` / `@@map` to snake_case.** App code is idiomatic TypeScript; the DB is exactly what `backstage-schema.sql` describes; raw SQL we ever write keeps working unchanged.

Every column whose JS name differs from its DB name gets an `@map("snake_name")`. Every model whose TS name differs from its table gets `@@map("snake_name")` at the bottom of the model block. Enum values stay snake_case in both places (the SQL enum values like `in_progress` are already valid TS identifiers, so no rename needed).

## Consequences

- Raw SQL queries against the DB (Supabase SQL editor, `prisma.$queryRaw`, hand-written migrations) use snake_case — no translation needed.
- Prisma-generated TS types use camelCase — `task.dueDate` everywhere in app code.
- The cost is one `@map(...)` line per snake_case column. Worth it for the rest-of-codebase ergonomics.
- New columns must remember to add `@map`. A model without `@@map` defaults to PascalCase in the DB, which would break the SQL schema match. Watch for this in code review.
