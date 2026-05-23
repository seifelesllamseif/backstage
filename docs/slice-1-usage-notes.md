# Slice 1 — usage notes

Friction log for the first week of real usage. Most friction is invisible —
people hesitate for two seconds, shrug, work around it, and never mention it.
If you only log what people *say*, you catch maybe a third of what's real.
The method below is built around that fact.

This file *is* the Slice 2 brief.

## Method (read before day one)

### 1. Observe, don't wait

Once a day, watch one person actually use Backstage for two minutes.
Where their cursor hunts, where they squint, where they ask "wait, how do I…" —
that's the `hesitation` data, and it almost never arrives as a spoken
complaint. You're an observer this week, not a help desk.

### 2. Ask one closing question daily

End of day, one message to the test group:

> "Anything today you wanted to do in Backstage and couldn't, or did somewhere
> else instead?"

That single question surfaces the `whatsapp` and `expected` entries that
people would never volunteer otherwise. Without a prompt, "I just used
WhatsApp, it was easier" never gets reported — it's not dramatic enough to
mention. The question gives them permission.

### 3. Watch-fors

Specific patterns to log explicitly when they happen:

- **By Wednesday, are people's real tasks in the system?** If the only tasks
  by mid-week are still the fifteen seeded ones, that's itself a
  `whatsapp`-category finding — people aren't trusting it with their actual
  work. The test only counts once real tasks land.
- **Where do they hesitate twice?** Once is noise, twice is signal. Three
  people hesitating at the same spot is not your minimal UI being charming —
  it's a fix.
- **What did they reach for WhatsApp for?** Not "did anyone use WhatsApp" —
  *for what*. Specifics matter; "for a quick reaction" and "to assign work
  faster" are very different findings.

### 4. Don't touch the code

Except for day-blocking bugs (fix on `bugfix/<thing>`, merge to main, log
here). Every other change muddies the data you're measuring. The itch will
arrive by Tuesday. Hold it.

## How to log

One line per observation. Format:

```
YYYY-MM-DD  [category]  [person]  — what happened.
```

Categories, in priority order:

- **whatsapp** — reached for WhatsApp anyway. *Find out what for.* Slice 1 missing its one job. Highest signal.
- **hesitation** — paused, asked, hunted, or got stuck. Usability bug wearing a costume. Includes things *you* spotted by watching, not just what they said.
- **expected** — they looked for something that wasn't there. Genuine Slice 2 signal. *Third*, not first.
- **blocker** — day-blocking bug. Fix on `bugfix/<thing>`, merge, log here so the pattern is visible.
- **good** — something worked unprompted and smoothly. Tells us what *not* to mess with later.

Don't sort. Don't edit. Don't second-guess. Friday review only.

## Log

<!-- one line per observation; add below this comment -->

---

## Test environment

- **Six accounts, shared dev password** (`backstage-dev`) across `iman / tariq / layla / omar / nadia / karim @skam.test`. **This is deliberate and temporary for the one-week closed test only.** Rotate to per-user passwords or magic-link before any wider audience touches it — shared credentials have a way of quietly surviving into things they shouldn't.
- **Two projects** seeded: Operations (standing) + Pilot Episode.
- **Fifteen pre-loaded tasks**, two intentionally overdue (so the red treatment is visible). Reminder: these are *not* usage data — see Watch-fors §3 above.
- Acceptance checklist for slice 1 in `docs/backstage-os-slice-1-plan.md` §8 — all eleven items should already pass.
- Board UI is plain on purpose. Design fidelity from `/backstage/project/*.jsx` lands in a follow-on pass *after* this week's findings.
