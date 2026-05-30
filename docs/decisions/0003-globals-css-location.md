---
status: accepted
decided_on: 2026-05-23
---

# 0003 — globals.css lives at `styles/globals.css`

## Context

The repo started from `create-next-app`, which puts `globals.css` inside `app/`. At some point the file was moved to `styles/globals.css` and the original deleted, but `app/layout.tsx` was not updated — it still imported `./globals.css`, which no longer existed. The build was broken.

## Decision

Keep `globals.css` at `styles/globals.css`. `app/layout.tsx` imports it via the path alias:

```ts
import "@/styles/globals.css";
```

The `@/*` alias is configured in `tsconfig.json` and resolves to the project root, so `@/styles/...` works from anywhere.

The Verbivore dark-theme tokens that landed in step 7 ([0014](0014-step-7-polish-scope.md)) live in this same file — `styles/globals.css` is the single CSS surface for the app.

## Consequences

- `app/` stays focused on routes and route-level files; global styles live in their own folder alongside any future global CSS (e.g. a print stylesheet, a theme-override sheet).
- Tailwind v4's `@theme` block can grow without crowding `app/`.
- shadcn's `components.json` may emit a `css` field pointing at `app/globals.css` by default — when running `pnpm dlx shadcn add ...`, double-check it points at `styles/globals.css` and update the file if needed.
