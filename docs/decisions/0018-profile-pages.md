---
status: accepted
decided_on: 2026-05-24
---

# 0018 — Profile pages (bento port)

## Context

Reference: `old/portfolio/_components/Portfolio.tsx` — a single-user bento dashboard with photo, bio, role, tasks, today/events, quote, socials, languages, framer-motion fade-in on mount. The user wants this shape "for every person" — every `crew_member` gets a profile page.

The reference is single-user (the founder's own home). Adapting to a multi-person product means: browseable URLs, schema additions for the profile data, and a redirect from "my profile" to my id.

## Decision

### Routing

- **`/people/[slug]`** — every member's profile, browseable by anyone in the company. `slug` is a url-safe handle derived from `full_name` at signup (see `lib/slug.ts`); unique per company.
- **`/profile`** — redirects to `/people/{currentMember.slug}`. The sidebar links here so a single nav entry serves everyone.
- The directory list at `/people` (everyone with avatar/role/tier) is **deferred** — comes when Slice 3's Crew Board lands or earlier if usage shows a need.

> Original draft of this decision used `/people/[id]` (UUID). Switched to slugs after the first review — UUIDs in URLs are ugly and leak nothing of value. Slugs are populated for existing members by a manual migration (`20260524000000_add_member_slug`); the column is `String?` in Prisma until a follow-up migration tightens to `NOT NULL`.

### Schema additions to `crew_member`

Six new nullable columns, no defaults:

| Prisma field | DB column | Type | Notes |
|---|---|---|---|
| `avatarUrl` | `avatar_url` | `String?` | Image URL or `/people/<file>.jpg` local path. `avatar_initials` stays as the fallback when null. |
| `bio` | `bio` | `String?` | Short paragraph. No length cap in DB; UI truncates if needed. |
| `socialInstagram` | `social_instagram` | `String?` | Full URL. |
| `socialLinkedin` | `social_linkedin` | `String?` | Full URL. |
| `socialWhatsapp` | `social_whatsapp` | `String?` | Full URL or `wa.me` link. |
| `languages` | `languages` | `String[]` | Postgres text array. Empty array default. |

Not added (deliberately):
- **`quote_text` / `quote_author`** — the bento's quote card is repurposed as a "Stats" or "Bio expanded" card in our port. Adding a quote field for a single small UI surface is overshoot.
- **`role_title`** — overlaps with slice-3 role tracking. The header strip uses `access_tier` ("admin" / "lead" / "member") plus the bio text for now. When slice 3 introduces real role records, the profile reads from there.

### Bento layout, mapped

Reference's seven sections → Backstage's six (no gallery card; no quote card):

| Reference slot | Backstage content |
|---|---|
| Name card (col-5) | Full name + access tier in SKAM red. |
| Photo card (col-3, rows 1–2) | `avatarUrl` if present; large-initials fallback otherwise. Hover state can later link to /people/[id]/dashboard but for now just shows. |
| Gallery card (col-4, rows 1–2) | Replaced by **Bio card**: bio text + role tier. Calm typography pass. |
| Tasks card (col-5) | The member's open tasks (`assignee_id = member.id AND status NOT IN ('done','canceled')`), top 4–6, ordered by due date asc nulls last. Each row links to `/projects/[projectId]?task=<id>` (panel route from 0017). |
| Today + events card (col-5) | Today date + member's upcoming task due dates (next 5). Reuses task data, not a separate events table. |
| Quote card (col-3) | Replaced by **Handoffs to fill** count card — small visual block showing how many of their open tasks have incomplete handoffs, with link to /cockpit's Handoffs block. |
| Languages + socials (col-4) | `languages` array as a row of pills; socials as a row of icon-links (Instagram, LinkedIn, WhatsApp). |

### Animations

Framer-motion fade-in on mount (per the reference). One new runtime dep (`framer-motion`). Animations are decorative; the page works fine with JS disabled / motion-reduced.

### Edit access — inline on the bento

Self OR admin can edit. There's no separate edit route — the bento has an "Edit profile" / "Edit (admin)" button that toggles the About / Languages / Socials / Avatar cards into input fields inside a single form. One Save action; one Cancel button that reverts. The same primitives stay (Tasks / Today / Handoffs cards never become editable).

> Original draft of this decision deferred editing to a follow-on commit and proposed `/people/[id]/edit` as a separate page. Switched to inline-on-bento because (a) a separate route for ~6 fields was overhead, and (b) editing-in-place is the standard pattern for personal profiles. The dedicated `/people/[slug]/edit` page is gone.

### Sidebar

Add a `Profile` nav item between Cockpit and Projects. Icon: `UserCircle2` from lucide. Links to `/profile` (which redirects to `/people/<my id>`).

## Consequences

- **Six new columns on `crew_member`** — biggest schema change since slice 1. Migration drops cleanly because all are nullable; no data backfill required for empty values. Seed updates fill the existing six members with plausible content.
- **`/old/portfolio` stays as the reference**, never imported. The new components live in `app/(authenticated)/people/[id]/`. No code from `old/` is copied — only idioms (bento grid shape, name-card treatment, fade-in pattern).
- **No real photos in seed.** Initials fallback renders for all six members. If the user later drops images into `public/people/<email-stub>.jpg` and updates `avatarUrl`, the photo card shows them.
- **Editing is the next pass.** A follow-on commit adds `/people/[id]/edit` (own-profile only + admin override) with form actions writing to the new columns.
- **Quote card is gone.** The bento has six cards instead of seven. If a future slice wants quotes, it adds the columns then.
