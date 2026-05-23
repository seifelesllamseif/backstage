# Crew Cockpit — Page Build Spec

A build brief for the Crew Cockpit, the personal home page in Crew OS.
Hand this to Claude Code, or use it as your own checklist.

## Purpose

The first screen every person sees on login. It answers, in five seconds:
what do I do today, what is blocked, where am I in my internship. It is a
read-mostly dashboard: it shows status and links out to the real editors
(board, timeline). It is not a second task editor.

## Who sees it

Any logged-in crew member sees their own Cockpit. All data is scoped to
that one person. Nothing here is admin-only.

## Layout

Single column, max width about 980px, centered. Five blocks, top to bottom.
The order is the priority order — most urgent at the top.

1. Header strip
2. Onboarding tracker        (full width)
3. My tasks + right rail     (two columns: tasks 1.5fr, rail 1fr)
4. (right rail holds: My allocation, then Handoffs, stacked)
5. My roadmap                (full width)

On narrow screens the two columns stack into one.

## Block by block

### 1. Header strip
- Avatar (initials), name, and a sub-line: "role · contract type · lifecycle status"
- Right side: internship position, e.g. "Day 6 of 90 · ends 20 Aug"
- Data: crew_member (full_name, primary_role, contract_type, lifecycle_status,
  start_date, end_date)

### 2. Onboarding tracker
- Only renders when lifecycle_status = 'onboarding'. Hidden for active members.
- Progress bar (steps done / total) + mentor name
- Step pills with three states: done, in progress, not started
- Data: onboarding (status, mentor), onboarding_step (label, is_done, sort_order)

### 3. My tasks
- List of the person's open tasks, newest-relevant first
- Each row: status pill, task title, a sub-line "project · solo or with [name]",
  due date (due date turns red if overdue)
- "View board" button links to the project board, filtered to this person
- Data: task (title, status, due_date, project), allocation for project names,
  task assignees to resolve the pairing

### 4. My allocation
- One number: total allocation percent across all projects
- A split bar, one segment per project
- Per-project rows with percent
- State rule: total <= 100 shows green; total > 100 shows red and an
  "overloaded" note. This is the early-warning signal.
- Data: the crew_workload view, plus allocation rows per project

### 5. Handoffs
- Two short lists: "To fill" and "Received"
- A to-fill item that gates a task shows a "blocks Done" note
- Data: handoff (task, from_member, to_member, is_complete, status)

### 6. My roadmap
- The person's own milestones for the next 6 weeks, as simple time bars
- Header note makes the scoping explicit: "my milestones only"
- Data: milestone, filtered by the milestone visibility rules

## States to handle

- New person, onboarding: tracker visible, few or no tasks yet
- Active person: tracker hidden, tasks full
- Overloaded: allocation over 100, red treatment
- Empty: no tasks, no handoffs — show a calm empty line, not a broken layout
- Wrapping up: optionally surface a "finish your handoffs" nudge near the end date

## Design tokens — SKAM dark theme

- Page background:        #0E0E10
- Card background:        #161618
- Raised card / inset:    #1A1A1C
- Border:                 #2A2A2E  (0.5px)
- Divider:                #232327
- Text primary:           #F2F2F0
- Text secondary:         #A8A8AE
- Text muted:             #8A8A90
- Text dim:               #5C5C62
- Accent (SKAM red):      #E24B4A
- Success:                #5DCAA5
- Warning:                #EF9F27
- Info:                   #85B7EB
- Card radius: 12px. Pill radius: 999px. Inner gaps: 8–12px.

Accent discipline: red is used only for things that need attention — the
person's identity, onboarding progress, overdue dates, an at-risk allocation.
Never as a default fill. If red is everywhere it stops meaning "look here".

## Out of scope for this page

- Editing tasks inline (link out to the board instead)
- Any admin or cross-person data
- Notifications feed (handled elsewhere)
