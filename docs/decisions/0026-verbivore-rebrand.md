---
status: accepted
decided_on: 2026-05-29
---

# 0026 - Verbivore rebrand: brand name, palette, fonts

## Context

The app was scaffolded with SKAM as the seeded company and as the brand
identity (red accent, near-black palette, "SKAM studio" sublabel under
the Backstage wordmark in the sidebar). The product is actually for
Verbivore, a separate brand with a warm-cream + teal palette and a
serif-display / sans-body type pairing (Fraunces + DM Sans).

The package was named `backstage`; we now want `verbivore-backstage`
("Verbivore Backstage" reads as the internal product name and keeps the
Backstage identity for the ops tool while the parent brand changes).

## Decision

### Brand text

- All static "SKAM" / "skam" references in app code, comments, seed
  data, schema comments, and decision docs become "Verbivore" / "verbivore".
- Seeded emails move from `@skam.test` to `@verbivore.test`.
- Seeded task ref prefix moves from `SKAM-###` to `VERB-###`.
- Sidebar sublabel becomes "Verbivore studio".
- `skamTheme` constant in `lib/business-logic.ts` renames to
  `verbivoreTheme`. It was already documentation-only (no importers),
  so the rename is a pure name change.
- `reference/` (the legacy design HTML/JSX bundle) is left untouched -
  it's a frozen design source; rewriting it would obscure the original
  context.

### Package name

`package.json` `name` changes from `backstage` to `verbivore-backstage`.

### Palette

The Verbivore palette (warm cream + teal scale + serif display) is
applied by *adapting* the existing Tailwind v4 + shadcn token structure
in `styles/globals.css`, not by replacing the file. The structure is
preserved so:

- the `@import 'tailwindcss'`, `@import 'shadcn/tailwind.css'`, and
  `@theme inline { ... }` block keep working under Tailwind v4 (the
  user's source CSS was Tailwind v3 syntax),
- the `[data-theme='paper'|'mocha'|'ocean']` profile presets stay -
  per the "personal surfaces are customizable" preference, members
  still pick their own profile palette,
- the `dashboard-loader` keyframe and view-transition rules survive.

Token mapping (light `:root`):

| shadcn token | Verbivore source |
|---|---|
| `--background` | `--bg` `#ede8dc` |
| `--foreground` | `--text-primary` `#1c2a2a` |
| `--card` | `--bg-card` `#ffffff` |
| `--popover` | `--bg-card` `#ffffff` |
| `--primary` | `--teal-400` `#00a89e` |
| `--primary-foreground` | `--bg` `#ede8dc` |
| `--secondary` / `--muted` | `--bg-2` `#e4ddd0` |
| `--muted-foreground` | `--text-secondary` `#4a6060` |
| `--accent` | `--teal-300` `#4da1a4` |
| `--accent-foreground` | `--bg` `#ede8dc` |
| `--destructive` | `#ef4444` |
| `--border` | `rgba(100, 90, 70, 0.15)` |
| `--input` | `rgba(100, 90, 70, 0.28)` |
| `--ring` | `--teal-400` `#00a89e` |
| `--radius` | `0.5rem` |

`.dark` mirrors the structure with `--bg #0e1414`, card `#1a2424`,
text `#ede8dc`, borders `rgba(237, 232, 220, 0.08 / 0.18)`. Sidebar
tokens follow card/border. Chart and `--success/--warning/--info`
values stay.

### Fonts

`app/layout.tsx` adds `Fraunces` (variable `--font-display`) and
`DM Sans` (variable `--font-sans`) from `next/font/google`. `Geist`
and `Geist_Mono` stay for code/monospace. `Inter` is removed.
`@theme inline` exposes `--font-display` so `font-display` becomes a
Tailwind utility for headings.

### Profile theme presets

Kept as-is. The four presets (`dark`, `paper`, `mocha`, `ocean`) and
`lib/profile-themes.ts` are unchanged. Rationale: per-member profile
customization is a personal surface and shouldn't be flattened to a
single brand palette. See [0020-profile-theme-presets.md](0020-profile-theme-presets.md).

## Consequences

- The `paper` profile preset still uses red `#d63e3d` for its accent
  and warm cream for its background. This is intentional - it's a
  user-chosen profile skin, not the brand. The global Verbivore light
  mode (now `:root`) is teal-accented and replaces the prior red
  `:root`.
- The `skamTheme` rename touches no callers but is a public-symbol
  rename inside `lib/business-logic.ts`; future docs referencing the
  old name will be wrong.
- Seed data is destructive to re-apply: `pnpm prisma migrate reset &&
  pnpm db:seed` is required to materialize the new emails / refs /
  company slug. Existing dev databases with `slug: "skam"` data still
  work at runtime; they just don't match the new brand.
- The `reference/backstage design/` bundle still says SKAM. It's a
  frozen design source, not a live surface; touching it would muddy
  git history of the original design.
