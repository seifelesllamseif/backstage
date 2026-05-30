---
status: accepted
decided_on: 2026-05-25
---

# 0020 — Per-member profile theme presets

## Context

After 0019 landed the visual pass on `/profile/[slug]`, the user pointed at the deployed reference at https://katana.skamcards.store/ — a warm, paper-feeling light treatment — and asked for that look. The first instinct was to scope a light theme to the profile page; the user corrected: each member should be able to customize their own profile theme. The profile page is personal real-estate; a single design call (paper for everyone) tells the wrong story about what the page is for.

The app stays dark-only globally (decision 0017). Customization is **scoped to the profile content area** — sidebar, top bar, every other route remain on the global dark theme.

## Decision

### What

`team_member` gets a `profile_theme` text column. Each member picks one of a curated set of preset palettes; that preset drives the bento's color tokens via `[data-theme="…"]`. Default is `"dark"` — existing members keep the look they have until they change it.

### Preset set (v1)

Four hand-tuned palettes:

| Key       | Name   | Vibe                                                                                  |
| --------- | ------ | ------------------------------------------------------------------------------------- |
| `dark`    | Dark   | Default. Identical to the app's `:root` tokens — neutral charcoal + red accent.       |
| `paper`   | Paper  | Warm paper-white, near-black ink, red accent. Lifted from the `VERBIVORE_LIGHT` palette in `backstage/project/ui.jsx` (decision 0017 prepared this). |
| `mocha`   | Mocha  | Cream + chocolate brown. Warm light theme with brown accent, softer than Paper.       |
| `ocean`   | Ocean  | Slate + teal. Alternative dark variant — cool slate base, teal accent.                |

Palette values defined in §"Palette tokens" below. Each preset overrides the same token surface (`--background`, `--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--border`, `--input`, `--ring`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--popover`, `--popover-foreground`, `--destructive`, `--success`, `--warning`, `--info`).

Status colors (`--success`, `--warning`, `--info`, `--destructive`) shift slightly per palette for contrast — they stay semantically consistent (green good, red bad, etc.).

Why a curated set and not a free color picker:
- Each preset is designer-tuned for contrast, hierarchy, and mood. The free-picker option is high-rope-give-yourself for a low-traffic decision.
- Adding a new preset is one PR (a CSS block + an enum entry). Cheap to grow when usage signals demand.

### Schema

Single column, Prisma side:

```prisma
profileTheme String? @default("dark") @map("profile_theme")
```

Why **String** and not a Prisma enum:
- Postgres enum mutations (`ALTER TYPE … ADD VALUE`) have historical concurrency pain points in Prisma 7. Strings keep migrations boring.
- Validation lives in app code via a zod `z.enum` referencing `PROFILE_THEMES`.

Why **nullable** with `@default("dark")`:
- Matches the rest of the slice-1 fields on `team_member` (`avatar_url`, `bio`, socials are all `String?`). Nullable means "user hasn't engaged yet" and gives a clean `null` → fallback to default at every read site.

### Validation

Single source of truth in TS:

```ts
// lib/profile-themes.ts (new)
export const PROFILE_THEMES = ["dark", "paper", "mocha", "ocean"] as const;
export type ProfileTheme = (typeof PROFILE_THEMES)[number];
export const PROFILE_THEME_LABELS: Record<ProfileTheme, string> = {
  dark: "Dark",
  paper: "Paper",
  mocha: "Mocha",
  ocean: "Ocean",
};
```

The zod schema in `actions.ts` uses `z.enum(PROFILE_THEMES)`. The picker in the form maps over `PROFILE_THEMES`. The CSS blocks in `globals.css` define one selector per key. Any new preset added later touches all three files.

### Server action

`updateProfile` (decision 0018) gets one new field. Same self-or-admin gate; no new action. Validation rejects unknown strings with the same error path as the rest of the form.

### CSS scoping

`[data-theme="paper"]` / `[data-theme="mocha"]` / `[data-theme="ocean"]` selectors in `globals.css` re-declare the token variables. The `data-theme` attribute lives on the bento root container in `profile-bento.tsx`:

```tsx
<div data-theme={member.profileTheme ?? "dark"} className="min-h-screen w-full bg-background …">
```

Result: tokens cascade inside the bento; outside (sidebar, top bar) keep `:root` values. Verified by Tailwind's `--color-*` references resolving from the nearest declared CSS var.

`data-theme="dark"` is functionally a no-op (matches `:root`) but is still set for symmetry — easier to debug in dev tools when you see the attribute on every theme including default.

### Picker UI

Inside edit mode, a fourth section is added under bio / languages / socials. Layout: 4 swatches in a row, each a small button showing the palette's bg/card/accent sample plus the name. Selected one gets a ring. Stored in a hidden input or controlled state inside the form.

### Authz

Inherited from decision 0018: self or admin. No new gate.

### Default behavior

A member with `profile_theme = null` reads as `"dark"` at every site. Existing members keep the look they have today until they save a different value. No backfill migration needed.

## Palette tokens

(VERBIVORE_DARK and VERBIVORE_LIGHT lifted from `lib/business-logic.ts` and `backstage/project/ui.jsx` respectively. Mocha and Ocean are new for this decision.)

### Dark — `:root` (unchanged)

Already in `globals.css:62-112`. No edit; included here for reference.

```
--background: #0E0E10;   --foreground: #F2F2F0;
--card: #161618;         --card-foreground: #F2F2F0;
--muted: #1A1A1C;        --muted-foreground: #A8A8AE;
--accent: #E24B4A;       --accent-foreground: #F2F2F0;
--border: #2A2A2E;       --primary: #F2F2F0;
--destructive: #E24B4A;
```

### Paper — `[data-theme="paper"]`

```
--background: #F7F6F2;   --foreground: #1A1816;
--card: #FFFFFF;         --card-foreground: #1A1816;
--muted: #F1EFE9;        --muted-foreground: #5A5852;
--accent: #D63E3D;       --accent-foreground: #FFFFFF;
--border: #D9D6CE;       --primary: #1A1816;
--primary-foreground: #FFFFFF;
--secondary: #F1EFE9;    --secondary-foreground: #1A1816;
--popover: #FFFFFF;      --popover-foreground: #1A1816;
--input: #D9D6CE;        --ring: #D63E3D;
--destructive: #D63E3D;
--success: #2E9C74;      --warning: #C5800E;   --info: #3D7DBE;
```

### Mocha — `[data-theme="mocha"]`

```
--background: #F5EFE6;   --foreground: #3D2914;
--card: #FFFAF2;         --card-foreground: #3D2914;
--muted: #EFE5D4;        --muted-foreground: #6B4A2B;
--accent: #8B5A2B;       --accent-foreground: #FFFAF2;
--border: #E0D4C0;       --primary: #3D2914;
--primary-foreground: #FFFAF2;
--secondary: #EFE5D4;    --secondary-foreground: #3D2914;
--popover: #FFFAF2;      --popover-foreground: #3D2914;
--input: #E0D4C0;        --ring: #8B5A2B;
--destructive: #C2543E;
--success: #5E8C5A;      --warning: #B8841E;   --info: #4A7DA0;
```

### Ocean — `[data-theme="ocean"]`

```
--background: #0F1419;   --foreground: #E8EEF2;
--card: #1A2128;         --card-foreground: #E8EEF2;
--muted: #1F2832;        --muted-foreground: #95A5B3;
--accent: #5DCAA5;       --accent-foreground: #0F1419;
--border: #2A3540;       --primary: #E8EEF2;
--primary-foreground: #0F1419;
--secondary: #1F2832;    --secondary-foreground: #E8EEF2;
--popover: #1A2128;      --popover-foreground: #E8EEF2;
--input: #2A3540;        --ring: #5DCAA5;
--destructive: #E24B4A;
--success: #5DCAA5;      --warning: #EF9F27;   --info: #85B7EB;
```

Values are first-cut; the user can refine after using each preset.

## Skipped (deliberately)

- **Free color picker** — explicitly rejected by the user in favor of curated presets.
- **Light mode for the whole app** — decision 0017 reaffirmed. Only the bento gets the override; chrome stays dark.
- **A "preview before save" affordance** — not for v1. Picker selection takes effect on save; instant feedback is nice but adds state plumbing for a low-frequency action.
- **Per-section overrides (different accent per card)** — too much rope.
- **Custom background images / patterns (Tumblr-style skins)** — bigger scope. If usage shows demand, returns to the queue.

## How this relates to 0017 / 0018 / 0019

- **0017** (UI fidelity pass) stays valid; the app remains dark-only. 0020 explicitly scopes around it.
- **0018** (profile schema + bento port + slug routing + inline edit) — 0020 adds one column to the same model and one field to the same action. No changes to authz, routing, or the edit envelope.
- **0019** (visual idioms ported) — the bento layout and component idioms from 0019 are theme-agnostic. They work in every palette because they only reference tokens (no hard-coded grayscale).
