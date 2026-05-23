---
status: accepted
decided_on: 2026-05-23
---

# 0017 — UI fidelity pass (board + cockpit + task panel + app shell)

## Context

Slice-1 step 7 deferred design fidelity to a separate UI-heavy pass (decisions 0013, 0014). The slice-2 usage week didn't happen — only the founder logged in, no real tasks were added, no handoffs were tested in earnest (see the answered intake at `docs/slice-3-intake.md`). With no usage data to inform Slice 3, the honest next move is making what already exists *look like a product* rather than building a capacity board on top of an unused task board.

The reference is `/backstage/project/*.jsx` — the Claude Design handoff bundle vendored in commit `eba7dcb`. Memory rule `feedback-crud-first-ui-later` says "match visual output, not the prototype's internal structure" — so this pass ports the *idioms* (PersonChip shape, StatusPill colors, Card padding, sidebar shell), not the inline-style JSX itself.

## Decision

### Scope: targeted, four surfaces

- **App shell** — persistent left sidebar + top bar wrapping the `(authenticated)` route group. Only built nav items: Cockpit, Projects. No greyed-out "coming soon" entries — dead links to nothing communicate noise, not roadmap.
- **Project board** (`/projects/[id]`) — filter toolbar at top, six columns with per-status colors, PersonChip on cards, StatusPill replacing the current ad-hoc spans.
- **Task panel** — slide-over on the board (480px right-side), triggered by `?task=<id>` search param. Contains the task fields + the handoff form + the Done-gate inline message. Closing clears the param.
- **Cockpit** (`/cockpit`) — header strip with PersonChip lg + role/tier subline. My-tasks rows restyled with StatusPill + PersonChip + project chip. Handoffs block: to-fill rows with warning-tint background, received rows with from-PersonChip.

### Skipped (deliberately)

- **Projects list** (`/projects`) — low traffic and not visually broken. Returns to the queue if it becomes a sore spot in real usage.
- **Login page** — already minimal and not on the daily-use surface.
- **Standalone task edit page** (`/projects/[id]/tasks/[taskId]`) — redirects to `/projects/[id]?task=<id>` so the panel is the only editor. Saves a duplicate UI surface; preserves direct URLs.
- **Light mode** — slice-1 plan §10 said dark only. The design bundle includes light tokens; we don't wire them yet. If a future slice needs a light variant, the design's `SKAM_LIGHT` palette is ready to drop into `globals.css`.

### Implementation conventions

- **Primitives live in `components/ui/`** alongside shadcn-generated components — they're our components regardless of origin. Names: `person-chip.tsx`, `status-pill.tsx`, `filter-chip.tsx`, `icon-button.tsx`.
- **Icons via `lucide-react`** wherever possible (already in deps). Custom inline SVGs only when lucide has no match.
- **Status colors via existing `@theme` tokens** — `text-info` (in_progress), `text-warning` (in_review), `text-success` (done), `text-muted-foreground` (backlog/unscoped/todo), `text-foreground/40` (canceled). Tints use Tailwind v4's `bg-info/10` syntax.
- **Red discipline** — buttons primary CTA uses `bg-accent` (SKAM red `#E24B4A`); attention markers (overdue, blocks-Done) use `text-destructive` (same hex). This reconciles plan §10's "red for attention only" with the design's red-primary-button by treating the primary button as itself an attention marker (one per surface).

### Task panel: search-param routing

The board page reads `searchParams.task`. If present and the id maps to a task in the current company, the page fetches that task + assignees + handoff and renders `<TaskPanel ... />` next to the board grid. Closing the panel calls `router.push("/projects/[id]")` to clear the param.

This is the simplest Next.js 16 pattern that gives us:
- Shareable URLs (`/projects/abc?task=xyz` works).
- No parallel routes / intercepting routes complexity.
- Server-rendered task data on first paint.

The existing `/projects/[id]/tasks/[taskId]/page.tsx` is replaced by a thin redirect to the new pattern. The handoff section component (`handoff-section.tsx`) and its actions are reused inside the panel — no logic change, just rehoused.

## Consequences

- **Three new primitive components in `components/ui/`** — usable on later screens (crew profile, etc.) when those slices arrive.
- **The `(authenticated)` route group now has a layout chrome.** Every protected page renders inside Shell. Cockpit and projects list get the chrome for free.
- **The `/tasks/[taskId]` route changes meaning** — was a destination, becomes a redirect. Bookmarks survive because they end up at the same panel via the search-param URL.
- **The handoff section now lives inside the panel.** A future slice that wants a dedicated handoff page can rebuild the standalone view; this pass treats handoff editing as inseparable from the task it belongs to (which is what the design's `project-task-panel.jsx` says).
- **Dark only.** When the demand comes, the SKAM_LIGHT tokens from the design bundle drop straight into a `.light` selector in `globals.css`.
