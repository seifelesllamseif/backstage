# Crew OS Build Checklist

An internal operations platform: crew planning, task handoff, onboarding, and a
shared knowledge hub. For founders, employees, and apprentices.
Built on Postgres (via Prisma). Under 50 users per company.

> Working name. Rename freely.

Legend: ★ = MVP, build first. ◇ = suggested addition, accept or cut.

## 1. Problems to solve

The pains this system exists to kill. Check one when the build genuinely fixes it.

- [ ] Work scattered across WhatsApp, Drive, and loose folders, with no single source of truth
- [ ] WhatsApp chats disappear, so decisions and context get lost
- [ ] Onboarding a new person is slow and manual
- [ ] Inheriting a previous person's work is a mess, with no structure or notes
- [ ] New people can't document, and can't take large or complex tasks unaided
- [ ] No reliable view of who holds which role, or who has which tasks
- [ ] Jira, Notion, Basecamp, and similar tools are hard to use and priced wrong
- [ ] No way to control the timeline with selective visibility
- [ ] Hard to tell when a role is under or over staffed

## 2. Confirmed features (what you've asked for)

### Foundation
- [ ] ★ Auth, with role titles: founder, co-founder, admin, lead, employee, apprentice
- [ ] ★ Title vs access split: titles carry identity, access collapses into a few tiers
- [ ] ★ Postgres via Prisma, so schema and data migrations stay easy
- [ ] Built to be reused for another company later, without a rewrite

### Task board
- [ ] ★ Statuses: Backlog, Unscoped, To do, In progress, In review, Done
- [ ] ★ Assignees and due dates per task
- [ ] Task dependencies / linked tasks
- [ ] Discipline labels: Audio, Design, Casting, Marketing, Writing, etc.

### Crew Profile (the person record)
- [ ] ★ Primary role + secondary skills
- [ ] ★ Availability window: start date and end date
- [ ] ★ Work mode: on-site / remote / hybrid
- [ ] ★ Weekly capacity: hours or days
- [ ] ★ Contract type: intern, employee, founder, etc. (a field, not a label people wear)
- [ ] Lifecycle status: incoming, onboarding, active, wrapping up, alumni

### Crew Board (admin)
- [ ] ★ All roles, grouped, with open roles visible
- [ ] ★ Target headcount range per role, per month
- [ ] ★ Capacity status per role: critical, under, staffed, surplus
- [ ] ★ Redeployment: surplus flagged, candidates matched to shortages by skill

### Crew Cockpit (each person's own view)
- [ ] ★ My tasks
- [ ] ★ My handoff docs: to fill, and received
- [ ] ★ Who I'm paired with on each task
- [ ] A record of what I've shipped

### Handoff & docs
- [ ] ★ Handoff docs, accessible to the relevant people
- [ ] Role-targeted resources: devs get reminders + docs, designers get assets

### Timeline
- [ ] ★ Timeline / roadmap
- [ ] ★ Selective visibility: only chosen people see the full timeline

### Onboarding
- [ ] ★ "Start here" home: every new person lands here first
- [ ] ★ Onboarding tracker: every new person always has an assigned onboarder / mentor
- [ ] ★ Agreements to sign: paperwork a new person signs before starting work, tracked as a gate
- [ ] Tools directory: every tool the company uses, tagged internal or external
- [ ] Role onboarding pack: a checklist and resources per role

### Community & recognition
- [ ] Vault: shared hub for ideas, quotes, inspirations, and sources, with upvotes, downvotes, and comments
- [ ] Vault: share projects too, not just snippets
- [ ] Spotlight: highlight one or more people to the whole company for a set period (a month)

### AI
- [ ] AI assistant per role: answers questions and helps new people get going
- [ ] Powered by RAG over the Knowledge Base, on free Gemini Flash
- [ ] Suggests skills to learn for each role
- [ ] Note: the AI is only as good as the Knowledge Base it reads. Build the KB first.

## 3. Suggested additions

Accept or cut each. The heaviest are marked ★.

### Make handoff actually work
- [ ] ◇ ★ Handoff is a required field on every task, not a separate task
- [ ] ◇ ★ Definition of Done gate: a task can't close until its handoff is filled
- [ ] ◇ Handoff template: fixed fields, so people fill a form, not write an essay

### Capacity, smarter
- [ ] ◇ ★ Forecast view: project headcount 3 to 6 months out, see shortages before they hit
- [ ] ◇ Capacity in hours, not just heads
- [ ] ◇ Productions layer: capacity targets roll up from real productions, not guesses
- [ ] ◇ Per-person workload check: spot the overloaded person before they burn out
- [ ] ◇ Time-off / availability exceptions: people are students or have other commitments

### People & growth
- [ ] ◇ Skill tree: secondary skills level up through work and redeployment. Strong for people who work across several roles.
- [ ] ◇ Skill catalog per role: the menu the AI suggests from, and the skill tree maps to
- [ ] ◇ ★ Exit artifact: contribution log auto-compiles into a summary / certificate
- [ ] ◇ Named mentor per person during onboarding, with a check-in log
- [ ] ◇ Buddy pairing for every new person
- [ ] ◇ Alumni pool: keep ex-member profiles for re-hiring, references, mentorship
- [ ] ◇ Lightweight review on completed work: feeds the skill tree and exit artifact

### Lifecycle & exits
- [ ] ◇ ★ Urgent withdrawal: an emergency-exit flow for when someone leaves suddenly (fast handoff, reassignment, cover plan)
- [ ] ◇ Planned offboarding ritual: handoffs must be complete before a term closes
- [ ] ◇ Recruiting pipeline: applied, interview, incoming, tied to open roles

### Knowledge & findability
- [ ] ◇ ★ Knowledge Base: official SOPs, role guides, policies. This is also what feeds the AI.
- [ ] ◇ ★ Global search across tasks, docs, handoffs, and the Vault
- [ ] ◇ Templates library: tasks, docs, handoffs all start from a template
- [ ] ◇ Org directory: who's who, role, contact, who they report to

### Permissions & oversight
- [ ] ◇ ★ Row-Level Security (Postgres): write the visibility rule once, enforced everywhere
- [ ] ◇ Role families: keep the long role list readable
- [ ] ◇ Activity / audit log: who changed what
- [ ] ◇ Read-only founder / exec view
- [ ] ◇ Weekly digest email per person: your tasks, what's due, what's blocked

## 4. Out of scope (on purpose)

The scope-creep firewall. Decided not to build, for now:

- Real-time sync / collaborative editing
- In-app chat. WhatsApp stays for live pings only
- Native mobile app. Responsive web is enough at this size
- Heavy notification infrastructure. The weekly digest covers it
- Anything public-facing

## Build order at a glance

1. Foundation: auth + roles
2. Crew Profile: the data everything feeds on
3. Task board: with the handoff field + Definition of Done gate
4. Crew Board: capacity lights + redeployment
5. Crew Cockpit
6. Timeline: with Row-Level Security visibility
7. Onboarding: "Start here", tracker + mentor, agreements, tools directory
8. Knowledge Base: fill it with real content
9. AI assistant: only after the KB has substance
10. Spotlight

Vault is mostly standalone (you've already built the page), so slot it in whenever.
Everything not marked ★ comes after the essentials ship.
