# Decisions log

Lightweight ADR-style record of choices made while building Backstage. The "why" lives here; the "what" lives in code. If the two disagree, code wins and the decision needs an update or a superseding entry.

## Convention

- One markdown file per decision, numbered: `NNNN-kebab-title.md`.
- Frontmatter at the top with `status`, `decided_on`, and `supersedes`/`superseded_by` if relevant.
- Status values: `proposed`, `accepted`, `superseded`, `deprecated`.
- Body has three short sections: **Context** (what made this decision necessary), **Decision** (the actual choice), **Consequences** (what changes about how we build).
- Never delete a decision. If it changes, write a new numbered file and mark the old one `superseded` with a pointer.

## Why this exists

The user works with multiple agents over time and the docs in `docs/` change frequently. A typed code constant (`lib/business-logic.ts`) carries the rule; a decision doc carries the reasoning. Future-you needs both.

## Index

- [0001 — Slice 1 stack](0001-slice-1-stack.md) — which packages to install now, which to defer.
- [0002 — Supabase / Prisma boundary](0002-supabase-prisma-boundary.md) — the `auth.users` vs `crew_member` rule.
- [0003 — globals.css location](0003-globals-css-location.md) — CSS lives at `styles/globals.css`.
- [0004 — Prisma schema scope](0004-prisma-schema-scope.md) — slice-1 plan §4 is the source of truth for what gets modeled.
- [0005 — Prisma naming convention](0005-prisma-naming-convention.md) — camelCase models, snake_case DB via `@map`.
- [0006 — Prisma migrations workflow](0006-prisma-migrations-workflow.md) — the init-migration stitch for the auth FK, and every-migration-after.
- [0007 — Prisma 7 adapter pattern](0007-prisma-7-adapter-pattern.md) — `prisma.config.ts` + `@prisma/adapter-pg` + single pooler URL (amends 0001 and 0006).
- [0008 — RLS baseline on all public tables](0008-rls-baseline-without-policies.md) — enable RLS with no policies to close the PostgREST exposure; defer policy design to later slices.
- [0009 — Seed script approach](0009-seed-script-approach.md) — one-shot, shared dev password, SKAM-themed; needs the service role key.
- [0010 — Auth architecture](0010-auth-architecture.md) — Next.js 16 proxy.ts (not middleware.ts), three Supabase clients, getClaims() for authorization, (authenticated) route group gate, login-only no signup.
- [0011 — Projects step patterns](0011-projects-step-patterns.md) — admin+lead create gate via requireAccessTier helper, company scoping on every query, hide archived by default.
- [0012 — Board read patterns](0012-board-read-patterns.md) — six columns (canceled hidden), sort by due-date asc nulls-last, card shape, mobile = horizontal scroll, no project-relative task id for slice 1.
- [0013 — Step 5 CRUD-first](0013-step-5-crud-first.md) — task CRUD + project archive backend in full; UI scaffold is minimal; validation messaging and pixel-matching the design bundle deferred to step 7.
- [0014 — Step 7 polish scope](0014-step-7-polish-scope.md) — SKAM tokens wired into Tailwind v4 (single-mode dark), generic loading.tsx + error.tsx in the authenticated group, design fidelity to /backstage deferred.
