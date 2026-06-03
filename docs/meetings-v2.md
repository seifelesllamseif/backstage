# Meetings v2

What shipped after `/plan` (waves 1 + 2 + most of wave 3). Use this as the
map when picking the file to edit; the surface area is wider than the
original 1:1-only flow.

---

## End-to-end shape

```
        ┌─ wizard (MeetingsPanel)              ┌─ approve / reject  ─┐
        │   New meeting flow                   │                     │
member ─┼─ "Request meeting about this task" ──┼─ pick slot/time ────┼─> Google Calendar event + Meet link
        │   (TaskDetail Linked meetings)       │                     │
        └─ teammate row context menu           └─ reschedule ────────┘
                                                                     │
                                                                     ▼
                                                            post-meeting review
```

Lifecycle: `pending → approved → scheduled → completed` for 1:1,
`pending → scheduled → completed` for group meetings (admin approval
locks the time). Any participant can `cancel`, `decline`, or
`reschedule`.

---

## Data model (Supabase, public schema)

- `meeting_requests` - one row per meeting, all of the lifecycle state.
- `meeting_attendees` - join table, `picked_at` set when 1:1 attendee
  chooses a time. Group meetings have 2+ rows here.
- `meeting_tasks` - join table linking a meeting to one or many tasks.
  Drives the "Linked meetings" section in TaskDetail and the
  back-reference on meeting cards.

Recent migrations on `meeting_requests`:

| column | added by | purpose |
| --- | --- | --- |
| `goal` / `context` / `questions` / `pre_read` | slice 1.A | mandatory pre-meeting brief, handoff-style |
| `requestee_context` | slice 1.A | optional 5th field, attendee fills after pick |
| `last_rescheduled_*`, `reschedule_reason` | slice 2.B | reschedule audit trail |
| `outcome` / `review_notes` / `reviewed_at` / `reviewed_by_id` | slice 3.A | post-meeting review |
| `follow_up_meeting_id` | slice 3.A | back-link if the review spawns another meeting |

Enums: `meeting_request_status`,
`meeting_outcome` (`resolved | partial | needs_followup | failed`).

---

## Entry points (the "where do I create one?" question)

| surface | file | who | shape |
| --- | --- | --- | --- |
| Multi-step wizard | `MeetingCreateWizard.tsx` | any member | 4 steps: attendees / topic+brief / when / review. Default entry from the Meetings page "+ New meeting" button and the right-click "New meeting" item. Keyboard: **Alt+M** (`⌥M` on macOS). |
| Per-teammate sheet | `MeetingRequestSheet.tsx` | any member | Older flow, still used by Sidebar teammate rows + TaskDetail "Request meeting about this task". Carries a `linkedTaskId` prefill when launched from a task. |
| Both | `supabase/dashboard/meetings.ts` -> `createMeetingRequest` | server action | Single zod-validated entry. Brief fields required. |

The wizard step-1 attendee list shows each member's saved timezone diff
relative to the viewer (`+2h`, `-30m`, "same time"). Step-3 renders a
"Maryam: 3:00 PM CEST · Ali: 4:00 PM AST" preview beneath every
proposed datetime input so the requester can see what they're asking
for in each attendee's local frame.

---

## Inbox sheet (`MeetingsSheet.tsx`)

One sheet, role-aware sections:

- **Pending approval** (planners only)
- **Awaiting your pick** (1:1 attendee, post-approval)
- **Awaiting your review** (any participant, meeting end-time has passed and no review yet)
- **Your requests**
- **Meetings with you**

Each section card carries the brief preview, attendee chips, share
buttons, and the meet link. Status-aware action footer (approve /
reject / pick / decline / reschedule / cancel / review).

**Focus deep-link.** `open({ focus: 'pending' | 'awaiting' | 'scheduled' | 'review' })`
narrows the sheet to one section so the Meetings panel stat cards and
the Updates panel meeting rows can link to exactly what they describe.
The focus pill in the header includes a `← Show all sections` escape.

---

## Calendar panel (`MeetingsPanel.tsx`)

Full-page calendar with three views: **Month**, **Week** (hour grid,
6 AM - 11 PM, sprint Rocket icons on the day header, today's column
tinted teal with a pinging "Today" chip), **List**. Sprint bars overlay
the all-day strip. Meetings in `canceled / rejected / declined` status
are filtered out so the view stays "what's actually on my schedule."

Stats row across the top is clickable; each card opens the inbox sheet
with the matching focus or jumps the week view to today.

---

## Pre-meeting brief (`lib/meetingBrief.ts`)

Three required, two optional:

| field | required | who | rendered in |
| --- | --- | --- | --- |
| `goal` | yes | requester | request email, sheet, OG card |
| `context` | yes | requester | request email, sheet |
| `questions` | yes | requester | request email, sheet |
| `pre_read` | no | requester | sheet (links list), email |
| `requestee_context` | no | requestee, post-pick | requester's card + scheduled email |

Drafts are stored in `localStorage` keyed by requestee id so an
accidental close doesn't wipe progress.

---

## Post-meeting review

`submitMeetingReview(meetingId, { outcome, notes })` is participant-only
and only accepts meetings whose `selected_starts_at + duration_min` is
already in the past. Submitting flips status to `completed` and logs
`meeting.reviewed` activity. The UI lives in `ReviewCard` (4 outcome
pills + notes textarea), surfaced through the new "Awaiting your
review" section and the matching stat card. Follow-up meetings can be
linked via `follow_up_meeting_id` (column exists; UI follow-up is the
next polish).

---

## Activity feed

Every lifecycle event emits an `activity_logs` row with
`entity_type='meeting'`:

- `meeting.requested`
- `meeting.approved` / `meeting.rejected`
- `meeting.scheduled` (also fires when an admin approval of a group
  meeting jumps straight to scheduled, and when a 1:1 attendee picks a
  time/slot)
- `meeting.declined`
- `meeting.rescheduled`
- `meeting.canceled`
- `meeting.reviewed`

`metadata.title` is populated so the Updates panel can render readable
lines without joining back. `mapMeetingActivity` in
`_components/mappers.ts` shapes them to `MeetingUpdate` rows that flow
into the existing `globalActivity` array; clicking a meeting row in
Updates opens the inbox sheet via `focusedRequestId`.

---

## Sharing

- `app/share/meeting/[id]/page.tsx` - public, auth-free meeting summary
  used by the WhatsApp/share button. 404s for canceled or non-public
  statuses (`SHARE_VISIBLE_STATUSES` in `meetings.ts`).
- `app/share/meeting/[id]/opengraph-image.tsx` - dynamic OG image,
  brand bar + title + day/time + participant avatars.
- `copyShareLink` helper in `DashboardShell.tsx` got a meeting variant.

---

## Timezone handling

Every in-app surface that formats a meeting time uses the viewer's
saved IANA timezone (`team_members.timezone`). Lookup is one-line:

```ts
const viewerTz = team.find((m) => m.id === currentUserId)?.timezone ?? null
```

Helpers live in `lib/timezone.ts`:

- `formatTimeIn(date, tz, opts?)`
- `formatDateTimeIn(date, tz)`
- `formatDayIn(date, tz)`
- `tzAbbrev(date, tz)`
- `formatTzDiff(date, viewerTz, theirTz)` - "+2h" / "-30m" / "same time"

The cross-TZ slot preview in the wizard + request sheet uses
`formatTimeIn` against each attendee's tz; the PickCard inbox card
renders `requester: <time in their tz>` under each slot so the
requestee doesn't accidentally pick a slot at 3 AM their counterpart's
time.

Server-rendered emails go through the same path - see
`lib/email/templates.ts:formatSlotList`. Both surfaces stay aligned.

Known gap: pick-a-day mode stores a bare `YYYY-MM-DD` with no tz; we
treat it as the requester's calendar day. Migration to add
`proposed_date_tz` is parked.

---

## Emails (`lib/email/templates.ts`)

New helpers `avatarChip(name, url, opts)` and `avatarWithName(...)`
render a 28px round avatar (img if URL, deterministic-color initials
fallback). Used in the mention, assignment, meeting request, meeting
approved, meeting scheduled, and meeting rescheduled email bodies.

All meeting emails format times in the recipient's saved timezone
(`recipientTimezone`) with the short TZ name appended -
`Wed, Jun 3, 2:00 PM AST`.

---

## Tasks ↔ meetings

- `meeting_tasks` join. `linkTaskToMeeting` / `unlinkTaskFromMeeting`
  server actions, gated on participant or planner.
- TaskDetail "Linked meetings" section shows status badge + counterparty
  + day/time + cancel/share dot.
- "Request meeting about this task" button in TaskDetail opens
  `MeetingRequestSheet` with `prefill.linkedTaskId` set; the default
  requestee is the task lead (falls back to assignee when the viewer
  is the lead).
- Wizard step-2 has a `TaskPickerField` that suggests existing tasks,
  scoped by **shared with attendees** (default when attendees are
  picked), **my tasks**, or **all**.

---

## Permission model (cheat sheet)

| action | gate |
| --- | --- |
| Create a meeting | any member |
| Approve / reject | admin or lead |
| Pick a time / slot | only the attendee |
| Decline (1:1 only) | only the attendee |
| Reschedule | participant (either party) or planner |
| Cancel | requester only |
| Append `requestee_context` | attendee, status `approved` or `scheduled` |
| Submit review | any participant, meeting end-time must be past |
| Link / unlink task | participant or planner |
| Edit task tags | admin / lead / task creator. New tag names require admin/lead. |

---

## Files touched (top-level map)

```
supabase/dashboard/meetings.ts        all server actions + email fanouts
supabase/dashboard/fetch.ts           +meetingActivity query
supabase/types.ts                     regen for outcome / review cols
supabase/migrations/                  meeting_reviews migration

lib/email/templates.ts                avatar helpers + avatar props
lib/meetingBrief.ts                   brief field metadata
lib/timezone.ts                       viewer-tz formatters
lib/google/calendar.ts                deleteCalendarEvent (for reschedule/cancel)

app/share/meeting/[id]/               public OG + share page

app/(workspace)/dashboard/
  _components/
    MeetingCreateWizard.tsx           4-step new-meeting flow
    MeetingsPanel.tsx                 month/week/list calendar
    MeetingsSheet.tsx                 inbox (all sections + review)
    MeetingRequestSheet.tsx           per-teammate request sheet
    TaskDetail.tsx                    Linked meetings section, editable tags
    Panels.tsx                        Updates feed: meeting kind + filter
    DashboardShell.tsx                wizard provider, keyboard shortcuts,
                                       meeting click handlers
```

---

## Parked

- **Calendar conflict warning (Slice 3.B).** `freeBusy` query against
  the requester's calendar when picking a slot. Render a yellow
  "Scheduler is busy then" pill. Warning only, never blocks.
- **Two-way Calendar sync (Slice 3.D).** `events.watch` webhook +
  cron polling fallback so deletions / time changes in Google Calendar
  flow back to Backstage.
- **`proposed_date_tz` column.** Tags pick-a-day meetings with the
  requester's IANA zone so the requestee's "day" boundary matches.
