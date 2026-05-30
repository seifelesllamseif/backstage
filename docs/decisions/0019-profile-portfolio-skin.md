---
status: accepted
decided_on: 2026-05-25
---

# 0019 — Profile portfolio skin (visual re-pass on /profile/[slug])

## Context

Decision 0018 shipped the working bento at `/profile/[slug]` — real data binding, inline edit, self/admin authz. The user finds the current visual treatment plain and wants the profile page to feel like the standalone mockup vendored at `/portfolio/` (eight files: `NavigationBar`, `TitleSection`, `BioSection`, `ProfileImage`, `ProjectList`, `SocialLinks`, `ContactBox`, plus `data.ts` / `types.ts`).

`/portfolio/` is a single-page mockup, not a wired component library:
- Mock data is anime-themed (Tokyo Ghoul / "katana" branding, Ken Kaneki quote, "Whisper to me"). Not Backstage content.
- Components are presentational shells that take `boxClass`, `variants`, and `textSizeClass` props — one level of indirection less idiomatic than the rest of the codebase, where page-specific JSX co-locates with the page and uses the semantic `card` class directly.
- Colors are hard-coded grayscale (`text-black`, `bg-gray-200`, `bg-amber-400`, `bg-white/10`). The app uses semantic tokens (`bg-card`, `text-foreground`, `text-accent`, `border-border`) so dark mode and theming work.
- One component (`NavigationBar`) duplicates the authenticated layout's shell.
- One component (`ProfileImage`) renders a cursor-tracking quote tooltip from a `quoteText` prop. Decision 0018 explicitly omitted `quote_text` from `team_member`.

The honest "wholesale move" is therefore **adopt the visual idioms, not the file structure**, matching the rule established by decision 0017: *"port the idioms (PersonChip shape, StatusPill colors, Card padding, sidebar shell), not the inline-style JSX itself."*

## Decision

### Scope

- One page only: `app/(authenticated)/profile/[slug]/profile-bento.tsx` and any co-located helpers. No changes to `/profile/page.tsx`, routing, schema, server action, or any other route.
- Done page-by-page; this decision covers the `[slug]` page. Other surfaces (cockpit, projects, board) keep their decision 0017 treatment.

### Visual idioms ported from /portfolio

| /portfolio source       | Lives on the bento as                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `TitleSection`          | Name card — H1 with the member's name, italic "with" connector, line break, role on line 2 |
| `ProfileImage`          | Photo card — cursor-tracking floating tooltip (see "Avatar hover" below)              |
| `BioSection`            | About card — same minimal padded box treatment                                        |
| `ProjectList`           | **Visual** treatment (hero card up top + bordered rows + arrow icons) reused on both **Tasks** and **Today/Upcoming** cards. Same look, separate cards, different data. |
| `SocialLinks`           | Socials row — hover-icon-behind-text animation on each platform link                  |
| `ContactBox`            | A small "Whisper" / contact CTA box if a member has a contact pref; otherwise omitted |
| `NavigationBar`         | **Dropped.** Authenticated layout already provides nav.                               |

### User calls (from this session)

1. **Project card behavior** → "Keep both, restyle separately." Tasks card and Today/Upcoming card both stay as discrete cards on the bento, both get the `ProjectList` visual treatment (hero + bordered rows + arrows), bound to their existing data (open tasks; upcoming due dates).
2. **Inline edit** → "Keep inline edit." The Pencil → Save flow stays exactly as it works today — same server action (`updateProfile`), same self-or-admin gate, same inputs (`avatarUrl`, `bio`, `socialInstagram`, `socialLinkedin`, `socialWhatsapp`, `languagesRaw`). Edit-mode inputs adopt the new visual treatment but the form contract is unchanged.
3. **Avatar hover-quote tooltip** → "Repurpose as bio hover." The cursor-tracking floating tooltip stays as an interaction; the content is `member.bio` (truncated if long), not a separate quote field. No schema change. If `bio` is null, the tooltip simply doesn't render. The dedicated About card remains — the tooltip is a redundant-but-fun surface.

### Color translation

Hard-coded grayscale → semantic tokens, mapped as follows:

| /portfolio class           | Bento equivalent                                  |
| -------------------------- | ------------------------------------------------- |
| `text-black`               | `text-foreground`                                 |
| `bg-gray-200`              | `bg-muted`                                        |
| `bg-amber-400` (icon glow) | `bg-accent` (or dropped if not load-bearing)      |
| `bg-white/10` (tooltip)    | `bg-card/80 backdrop-blur-sm border border-border`|
| `text-white` (tooltip text)| `text-foreground`                                 |
| `border-gray-300/30`       | `border-border/60`                                |

### File layout

- The bento and its visual sub-components live co-located with the page (`app/(authenticated)/profile/[slug]/`), matching the existing pattern. No `components/profile/` directory.
- Sub-components inside `profile-bento.tsx` are kept as inline JSX sections (named with a comment) unless one grows past ~60 lines, in which case it splits into a sibling file (`profile-bento.tsx`, `profile-card-tasks.tsx`, etc.).
- Dependencies: `framer-motion`, `lucide-react`, `date-fns` are already in deps. No installs needed.

### Fate of /portfolio/

After the port landed, `/portfolio/` was **moved to `old/portfolio-mockup/`** as a frozen reference, matching the existing `old/` convention. Note this is distinct from `old/portfolio/` (referenced by decision 0018) — that one is the *bento layout* source; `old/portfolio-mockup/` is the *visual idiom* source for this pass.

Going forward the live `profile-bento.tsx` is the source of truth — both archives are read-only references.

## Skipped (deliberately)

- **Add `quote_text` / `quote_author` to `team_member`** — explicitly rejected in decision 0018, reaffirmed here.
- **A real "Projects" surface on the profile** — the data model doesn't have member↔project links, and there's no usage signal pulling for it. Returns to the queue if a usage week surfaces a need.
- **Light mode** — slice-1 plan §10 dark-only stance carries over (decision 0017).
- **`/profile` (no slug) and `/cockpit`, `/projects/[id]` styling** — out of scope; this is page-by-page.

## How this differs from 0018

0018 was the *capability* port (bento layout + data binding + inline edit + slug routing). 0019 is the *visual* pass on the same page — no new capability, no schema change, no routing change. If the two ever conflict, 0018 wins on data shape and 0019 wins on visual treatment.
