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

### 3b. Watch-fors (slice 2 — handoffs + Done gate)

- **Gate-gaming.** Someone hits the Done gate, doesn't want to write seven
  fields, and types `x` / `n/a` / `tbd` into the missing ones to clear the
  gate. The handoff passes `is_complete`; the next person opens it and reads
  garbage. **This is the failure mode that means slice 2's founding pain
  isn't solved.** Specifically watch for: fields under ~20 characters,
  "see attached", "ask me", anything that obviously isn't real handoff
  content. Log as `whatsapp` — the work *is* going elsewhere (the next
  person's head, or a Slack DM to ask).
- **Which fields get skipped?** If `gotchas` and `who to ask` are
  consistently the empty ones, maybe those should be optional or merged.
  If `what it is` gets skipped, the task title is doing that work and the
  field is redundant. Either is a Slice 2 shape change, not a Slice 3
  feature.
- **Does anyone use the Edit toggle on a complete handoff?** If yes — what
  did they go back to fix? Typo, wrong assignee, new info? Tells us
  whether the right shape later is "edit everything" or a tighter "amend"
  surface.

### 4. Findings can mean rework, not just new work

A `whatsapp`-category finding from slice 2 — people gaming the gate, fields
routinely garbage, the next person still doing WhatsApp archaeology — is
**not** a "we'll get to it" Slice 2 improvement. It's evidence the slice
didn't solve its founding pain, and the right response is to redo slice 2's
shape (fewer fields, smarter hints, different gate), not to start Slice 3.
Don't carry a known-broken slice forward.

### 5. Don't touch the code

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
