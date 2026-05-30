---
status: accepted
decided_on: 2026-05-23
---

# 0001 — Slice 1 stack

## Context

Slice 1 ships a task tracker that gets one company off WhatsApp. The build plan (since deleted; see git history) named a thin set of capabilities: auth, projects, tasks on a six-column board, a cut-down Team Cockpit. Anything outside that is later slices.

An over-stuffed `package.json` is its own kind of mess. Deps installed now must be earning their keep in slice 1 today, not three slices from now.

## Decision

### Install now (ten new packages)

> Originally six. The Prisma 7 adapter pattern (see [0007](0007-prisma-7-adapter-pattern.md)) added four more: `@prisma/adapter-pg`, `pg`, `@types/pg` (dev), and `@prisma/config` (dev, for `prisma.config.ts` type imports).

| Package | Why it earns its keep in slice 1 |
|---|---|
| `prisma` (dev) + `@prisma/client` | Schema + migrations for the four slice-1 tables (`company`, `team_member`, `project`, `task`). |
| `@prisma/adapter-pg` + `pg` + `@types/pg` (dev) | Required by Prisma 7's new runtime — the client doesn't connect on its own, it needs a driver adapter. See [0007](0007-prisma-7-adapter-pattern.md). |
| `@prisma/config` (dev) | Type imports for `prisma.config.ts` at the repo root. The package is a transitive dep of `prisma`; we add it as a direct dev dep so TypeScript can resolve `import { defineConfig } from "@prisma/config"`. |
| `@supabase/supabase-js` + `@supabase/ssr` | Auth (email login) and the Postgres connection. `@supabase/ssr` is the App-Router-aware cookie/session helper. |
| `@tanstack/react-query` | Server-state on the board and cockpit. Lets a status change feel live without hand-rolling loading state. |
| `zod` | Validate every form input and every API/route handler payload. Doubles as the env-var validator. |
| `react-hook-form` + `@hookform/resolvers` | Form state for task create/edit and project create. Pairs with Zod via the resolver. |
| `date-fns` | "Overdue / due Mon" math on the board and cockpit. Tree-shakeable, light. |

Versions: latest stable, caret ranges. Reproducibility comes from `pnpm-lock.yaml`.

### Already present (no action)

Next.js 16 App Router, React 19, Tailwind v4, shadcn scaffold, `lucide-react`, Prettier, Husky. The `radix-ui` and `lucide-react` deps are on their post-rebrand v1 umbrella versions — left as-is until something breaks.

### Deferred to later slices (do not install)

- **Resend** — transactional email belongs to slice 4 (weekly digest, invites). No slice-1 surface area.
- **AI SDK / Gemini** — slice 5, after the knowledge base exists. The AI is only as good as the KB it reads.
- **dnd-kit** — slice 1 uses a status dropdown to move cards across the board. Real drag-and-drop is a later polish step.
- **TanStack Table** — only if/when the Team Board (slice 3) needs heavy tabular UI.
- **Recharts** — capacity bars are slice 3.
- **uploadthing / Supabase Storage** — no file uploads in slice 1.
- **@t3-oss/env-nextjs** — optional wrapper over Zod for env vars. Add only if hand-rolled validation gets clumsy.

## Consequences

- The slice-1 implementation is constrained to what these eleven deps (six new + the existing five) enable. If a feature needs a twelfth, it's a flag to re-check whether the feature belongs in slice 1.
- The Supabase Auth ↔ Prisma boundary becomes a live concern the moment `@supabase/supabase-js` is installed. See [0002](0002-supabase-prisma-boundary.md).
- Prisma is added to `devDependencies`; `@prisma/client` is a runtime dep. The CLI is dev-only by convention.
- TanStack Query needs a `QueryClientProvider` at the root before the first hook is used. Wiring it is a follow-up, not part of this install pass.
