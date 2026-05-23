# Slice 1 — usage notes

Friction log for the first week of real usage. Add a line every time someone
grumbles, hesitates, or opens WhatsApp anyway. Raw, ugly, unsorted. This file
*is* the Slice 2 brief.

## How to log

One line per observation. Format:

```
YYYY-MM-DD  [category]  [person]  — what happened.
```

Categories, in priority order:

- **whatsapp** — someone reached for WhatsApp anyway. *Find out what for.* That thing is Slice 1 missing its one job and is urgent. Highest signal.
- **hesitation** — someone paused, asked, or got stuck. Usability bug wearing a costume. If three people hesitate at the same spot, it's not your minimal UI being charming, it's a fix.
- **expected** — they looked for something that wasn't there. Slice 2 signal. *Third*, not first.
- **blocker** — day-blocking bug. Fix on `bugfix/<thing>`, merge to main, log here so the pattern is visible.
- **good** — something worked unprompted and smoothly. Tells us what *not* to mess with later.

Don't sort. Don't edit. Don't second-guess. Friday review only.

## Discipline for this week

- **Don't touch the code** except for day-blocking bugs. Every change muddies the data you're collecting. Observe, log, leave it alone.
- **Run real work through it**, not test data.
- **Daily glance** at this file. Friday: read it whole.

## Log

<!-- one line per observation; add below this comment -->

---

_Brief recap of what's live for the test:_

- Six accounts seeded: `iman@skam.test` (admin), `tariq@skam.test` (lead), `layla` / `omar` / `nadia` / `karim` `@skam.test` (members). Shared dev password: `backstage-dev`.
- Two projects: **Operations** (standing) and **Pilot Episode**.
- Fifteen tasks pre-loaded across the six board columns. Two are intentionally overdue so the red treatment is visible.
- Board UI is plain on purpose — design fidelity from `/backstage/project/*.jsx` lands in a follow-on pass after this week.
- Acceptance checklist is in `docs/backstage-os-slice-1-plan.md` §8 — every one of the eleven items should already pass.
