# Slice 3 — intake

Answer these before Slice 3 gets written. Two or three days of real use is
enough — not asking for a research study.

**"Don't know" is a valid answer.** "Nobody used it, I don't know" tells me
to spec defensively. Write that if it's true.

The questions that genuinely move the spec are **6, 12, 13, 15, and 18**.
If you answer only five, answer those.

> **Draft answers below come from the live DB where I could verify, and
> "don't know — needs you" where I couldn't.** Overwrite as you like.

---

## A. Did Slice 1 + 2 actually get used?

1. Did anyone other than you log in and do real work? Who, how many?
   - *Data: **1 auth user has ever signed in.** The other five seeded accounts (Tariq, Layla, Omar, Nadia, Karim) show `last_sign_in_at = null`. Translation: only you have logged in.*
2. Did *you* use it for your own real tasks for even a few days?
   - *Data: 3 tasks were edited since the seed; 1 handoff was touched since the slice-2 deploy. That's exploration-level activity, not "ran my work day on it." Only you know whether those edits were real or click-around. **Likely needs you.***
3. By now, are there real tasks in there, or still mostly the fifteen seeded ones?
   - *Data: **15 tasks total. 0 created after seed.** Still only the seeded set. No new real tasks have been entered.*
4. Did anyone open WhatsApp to do something Backstage should have handled? What, specifically?
   - *Don't know — observation didn't happen. **Needs you.***

## B. The handoff — the one that decides Slice 3's shape

5. Did anyone fill a handoff for a real task?
   - *Data: **5 handoffs total. 4 from the slice-2 patch script, 1 created/edited after deploy.** So at most ONE fresh handoff exists — could be a real fill or a click-around. **Needs you to say which.***
6. **(sharp)** When they did — all seven fields properly, or did they fight it? Short answers, `n/a`, `x` just to clear the gate?
   - *Don't know — n=1 max, and only you can characterize the content. **Needs you.***
7. Did the Done gate feel useful, or like an annoyance people resented?
   - *Don't know — only one person clicked the gate. **Needs you.***
8. Seven fields — too many, about right, or did people not even read the hints?
   - *Don't know — not enough fills to judge. **Needs you.***

## C. What broke or confused

9. Any bugs that blocked someone's day?
   - *Data: I don't know of any. Local tsc clean, the 11-item slice-2 acceptance verified at the SQL layer, Vercel build is green after the postinstall fix. But "no bug reports here" ≠ "no bugs in practice." **Needs you.***
10. Anywhere people hesitated, hunted for a button, or asked "how do I…"?
    - *Don't know — observation didn't happen. **Needs you.***
11. Anything they expected to exist and were surprised wasn't there?
    - *Don't know — observation didn't happen. **Needs you.***

## D. Capacity — Slice 3 is specifically about this, so I need the real picture

12. **(sharp)** How many people will actually be in the system — the real near-term number?
    - *Don't know — that's SKAM headcount data only you have. **Needs you.***
13. **(sharp)** How many projects run at once right now? Two, or more?
    - *Data: **3 projects exist in the DB** (Operations + Pilot Episode + one test project you made during dev). 0 added during use. The "real life concurrent projects" question is **needs you** — DB count is dev-artifact-inflated.*
14. Does the company genuinely move people between roles, or is that more aspiration than practice today?
    - *Don't know — SKAM-internal. **Needs you.***
15. **(sharp)** Who needs the Crew Board — is there a real admin who'll plan capacity with it, or is that you imagining a future user?
    - *Don't know. **Needs you.** This is the question where "imagining a future user" is a real and acceptable answer — write it if it's true.*

## E. The context that reorders priorities

16. Why Slice 3 next — because capacity is the real pain, or just because it's next on the list?
    - *Don't know. **Needs you.***
17. Is there a deadline or a moment this is building toward — a founder demo, a real onboarding wave?
    - *Don't know. **Needs you.***
18. **(sharp)** Be honest: is anyone actually going to *use* a capacity board soon, or is Slice 3 a feature you want to build more than one the company needs right now?
    - *Don't know. **Needs you.** Heart-stopper question — please don't soften the answer.*

---

## What the data already says (read before you fill in the rest)

Based on Q1, Q3, Q5: **the usage week didn't happen.** Six accounts exist;
one has signed in. Zero real tasks were added. At most one handoff was
touched after the slice-2 deploy. That is consistent with "you tested the
build, nobody else has touched it yet."

If §E confirms what the data suggests, the honest read is: **Slice 3 should
not be written yet.** Not because the spec is hard — because writing a
capacity board for a company that hasn't yet trusted the task board with
real work is building a feature on top of a feature nobody is using. The
most actionable move is the one we've been circling for two slices now:
get real tasks into the system, fill the log, and let the next slice be
shaped by what actually happened.

If §E says "yes there's a real admin, real deadline, capacity IS the pain
now" — fine, Slice 3 gets written. But §E is where that has to be made
explicit, in writing, before I spec a single table.
