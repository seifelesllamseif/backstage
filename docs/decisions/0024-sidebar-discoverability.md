---
status: accepted
decided_on: 2026-05-26
---

# 0024 — Sidebar discoverability: help hints + Mentions tab

## Context

After [[0023-member-scoped-dashboard]] tightened what members see, the
remaining usability problem was that members couldn't tell what each
sidebar destination *does*. "Inbox" especially: it was implemented as
`status === 'todo' || 'in_review'` on the visible task set, which isn't
a personal queue and overlaps with the Status filter section directly
below it.

Two questions came up in the same conversation:

1. How do new members learn what each sidebar item means without
   trial-and-error?
2. Is there a personal-queue surface members can use as a daily landing
   spot?

## Decision

### Help hints

Every main sidebar destination (All tasks, My tasks, Inbox, Mentions,
Archive, Projects, Updates, Symbols, Settings) gets a tiny low-contrast
ⓘ icon at the end of its row. Hovering the icon shows a one-line plain-
language explanation via the existing radix tooltip primitive.

Hints are centralized in a `HINTS` map at the top of `Sidebar.tsx` so
copy is editable in one place. Status and Team filter rows do **not**
get hints — their labels are self-evident and would clutter the column.

A "Show help hints" toggle lives in Settings (default **on**). The value
is persisted to `localStorage` (`dashboard.showHints`). Unlike the other
settings (density, WIP limit, notifyOnAssign) which are in-memory only,
help hints persist because the whole point of "turn this off once I
know my way around" is that the setting sticks across refresh.

### Mentions tab

A new top-level view: **Mentions** — tasks where the current user
appears in at least one comment's `mentions` array. Rendered as a
sibling row directly under Inbox in the sidebar (same indent as the
other main destinations; an earlier draft indented it but the visual
hierarchy didn't carry its weight).

Implementation is purely client-side: `TaskComment.mentions` is already
a `String[]` of CrewMember IDs (`MentionInput` writes member.id when it
matches `@FirstName`), and the dashboard's local `comments` state has
all visible comments. We derive `mentionedTaskIds` from that state in a
`useMemo` and filter `visibleTasks` against it when `view === 'mentions'`.
No new query, no schema change.

### Inbox semantics

We discussed redefining Inbox as a personal queue (my Todo + my
In-Review + @-mentions) or removing it entirely. We did neither — Inbox
keeps its current definition, and its hint now spells it out: *"Tasks
ready to start (Todo) or waiting for review."* If Mentions does the
job people wanted Inbox to do, we can revisit and drop or repurpose
Inbox in a later pass.

## Consequences

- The mentions count updates optimistically (it derives from local
  comment state), so adding `@Sara` in a comment immediately bumps her
  Mentions counter on her next page load. Until realtime is wired,
  Sara still needs to refresh — but server-side the activity log
  already records `comment.added` events.
- The `HINTS` map is hard-coded English. No localization yet; revisit
  when we have non-English users.
- `localStorage` access is wrapped in `useEffect` so SSR doesn't break.
  Default is `true` until the effect reads the stored value on mount —
  there's a one-frame flash where hints show even for users who turned
  them off. Acceptable; cheaper than threading a hydration flag.
