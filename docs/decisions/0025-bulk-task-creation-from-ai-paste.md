---
status: accepted
decided_on: 2026-05-26
---

# 0025 — Bulk task creation via "AI prompt / paste" flow

## Context

Adoption observation from slice-3 usage testing: members weren't
creating tasks. Filling out the manual form for a single task is fine,
but breaking a brief or a meeting into 5–10 well-shaped tasks is enough
friction that nobody does it. Meanwhile everyone on the team is
already comfortable with ChatGPT / Claude / similar.

The obvious solve is "let an LLM draft the tasks." We considered
wiring a server-side Anthropic SDK call but rejected it for now:

- Adds an API key, billing, and a per-keystroke cost surface to dogfood.
- Requires a preview UI anyway (LLMs invent details), so the only thing
  the SDK saves is one copy/paste step.
- The user explicitly preferred to keep the AI off our infra for the
  first cut.

## Decision

Bulk add is a **second tab inside the existing "+ New task" modal**,
labeled "From AI". The flow has no AI on our side:

1. We render a **prompt template** with the user's company context
   baked in: project name, valid statuses, valid priorities, the
   full list of available assignees (by full name), and available
   labels. The template ends with a placeholder line the user
   replaces with their task description. Source of truth:
   `_components/bulkPrompt.ts` (`buildBulkTaskPrompt`).
2. User clicks "Copy prompt", pastes it into whichever AI they like,
   appends what they need, and gets JSON back.
3. User pastes the JSON into a textarea in the same tab and clicks
   "Parse".
4. We deterministically parse the JSON (`parseBulkTaskJson`), match
   assignee names to member IDs (exact full-name match first, then
   unambiguous first-name match), match labels by exact name, and
   surface per-row warnings for anything we couldn't resolve.
5. The parsed tasks render as an **editable list** — title,
   description, status, priority, assignee, due date, label chips,
   per-row delete. Warnings appear inline. Nothing is persisted yet.
6. "Create N tasks" runs `createBulkDashboardTasks`, a new server
   action that wraps the inserts in a transaction. Refs are
   generated using the same project-name prefix + sequential
   `seq_number` scheme as single-task create. Each insert also writes
   a `task.created` activity-log row.

### Validation (Zod)

Both the client-side parser and the server action validate the input
with Zod. The schemas are intentionally separate:

- **Client (`bulkPrompt.ts → BulkTaskInputSchema`)**: lenient. Validates
  the outer shape (`{ tasks: [...] }`) and requires `title` on each
  task. Enum-y fields (`status`, `priority`, `dueDate`) accept any
  string and become per-row warnings during normalization, so one
  misspelled enum doesn't reject an otherwise-good batch. The parser
  surfaces the first Zod issue with a humanized path like
  `tasks[2].title: title is required`, so the user can find the bad row.
- **Server (`actions.ts → CreateBulkInputSchema`)**: strict. Requires
  UUIDs for `projectId`, `assigneeId`, `labelIds`; valid enum members
  for `status` and `priority`; `YYYY-MM-DD` for `dueDate`; a 1-50
  range on the drafts array. The client parser produces output that
  already conforms, so legitimate clients never trip these; the strict
  schema is a defense layer against a tampered client or a stale
  client during an upgrade.

### Output JSON shape

```json
{
  "tasks": [
    {
      "title": "string (required)",
      "description": "string or null",
      "status": "backlog | todo | in_progress | in_review | done | canceled | duplicate",
      "priority": "none | low | medium | high | urgent",
      "assignee": "exact full name or null",
      "labels": ["exact label names"],
      "dueDate": "YYYY-MM-DD or null"
    }
  ]
}
```

`title` is the only required field. The parser strips ```json fences
if the AI wraps the output despite being told not to.

### Auto-creating new labels

Initial design dropped unknown labels with a warning. First real test
made it obvious why that was wrong: the seed has zero labels, so every
label the AI proposed was "unknown" and every row lit up amber for no
good reason. We now **auto-create** labels the AI invents — but the
user reviews them first:

- Unknown labels render as **dashed `+ name` chips** alongside the
  existing label chips in each preview row. Clicking a dashed chip
  removes it (the label is not created and not attached).
- On submit, the server action collects every surviving dashed-chip
  name across all drafts, dedupes case-insensitively, and upserts each
  one as a `Label` row under `member.companyId` *before* creating the
  tasks. The merged label IDs are then attached as `TaskLabel` rows
  inside the same transaction.
- `findFirst(name: { mode: 'insensitive' })` before `create` prevents
  `"Design"` and `"design"` from racing into two rows. The
  `@@unique(companyId, name)` index is the safety net under that.
- The success toast appends "+ N new label(s)" when any were created,
  so the side effect isn't silent.

The prompt was relaxed accordingly: assignees still must come from the
list (we can't invent people), but new short labels are now explicitly
allowed.

### What's still not in scope

- No server-side AI call. Adding one is a one-file change later if we
  decide the copy/paste step is too much friction.
- No project picker in the Manual tab — single-task create still uses
  the dashboard's currently-selected project (kept for muscle memory).
  The AI tab does have its own picker because bulk-add was getting
  blocked at submit time when the dashboard had no current/default
  project; making it explicit in the modal removes that dead-end and
  also names the target inside the copied prompt.
- No color picked for auto-created labels. `Label.color` is nullable;
  the user can edit existing labels through whichever surface they
  prefer.

## Consequences

- The prompt is regenerated whenever members or labels change (it's a
  `useMemo` keyed on those props). A copy taken before changes will
  still reference the old lists; the parser will warn on stale names.
- Transactional bulk insert means a single bad row (e.g. an
  assigneeId that's been deleted between parse and submit) rolls back
  all created tasks. Acceptable at Verbivore scale and easier to
  reason about than partial success.
- Date parsing is strict `YYYY-MM-DD`. AIs sometimes emit "May 28"
  or "tomorrow"; those become warnings, not silent garbage.
- If/when we add a server-side AI call later, the parser, preview,
  and server action are all reusable — the only new piece is a
  `generateTasksWithAi` server action that returns the same JSON
  shape and skips the copy/paste textareas.
