// Helpers for the "From AI" bulk-task flow.
//
// The user copies the prompt we render here into ChatGPT / Claude / etc.,
// appends their request, and pastes the AI's JSON back. We parse it
// deterministically — no AI call from our side. See decision 0025.

import { z } from 'zod'
import type { TaskPriority, TaskStatus } from './status'
import { STATUSES } from './status'

// Shape Zod validates. We're intentionally lenient on status/priority/
// dueDate strings — those become per-row warnings during normalization,
// not hard parse failures, so a single misspelled enum doesn't reject
// an otherwise-good batch.
const RawRelationSchema = z
  .object({
    kind: z.string().nullish(),
    ref: z.string().nullish()
  })
  .passthrough()

const RawTaskSchema = z
  .object({
    title: z
      .string({ message: 'title must be a string' })
      .trim()
      .min(1, 'title is required'),
    description: z.string().nullish(),
    status: z.string().nullish(),
    priority: z.string().nullish(),
    assignee: z.string().nullish(),
    labels: z.array(z.string()).nullish(),
    dueDate: z.string().nullish(),
    relations: z.array(RawRelationSchema).nullish()
  })
  .passthrough()

const BulkTaskInputSchema = z.object({
  tasks: z.array(RawTaskSchema).min(1, 'the "tasks" array is empty')
})

export type BulkTaskInput = z.infer<typeof BulkTaskInputSchema>

const VALID_STATUSES: TaskStatus[] = STATUSES.map((s) => s.id)
const VALID_PRIORITIES: TaskPriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none'
]

export function buildBulkTaskPrompt(ctx: {
  projectName?: string | null
  members: { name: string }[]
  labels: { name: string }[]
  // Existing tasks the AI can reference in relations. Listed as ref +
  // title so the AI can pick the right target.
  existingTasks?: { ref: string; title: string }[]
}): string {
  const memberLines =
    ctx.members.length > 0
      ? ctx.members.map((m) => `  - ${m.name}`).join('\n')
      : '  (none — leave assignee as null)'
  const labelLines =
    ctx.labels.length > 0
      ? ctx.labels.map((l) => `  - ${l.name}`).join('\n')
      : '  (none — leave labels as [])'
  const projectLine = ctx.projectName
    ? `\nProject: ${ctx.projectName}\n`
    : ''
  const existingTasks = ctx.existingTasks ?? []
  const taskLines =
    existingTasks.length > 0
      ? existingTasks
          .slice(0, 30)
          .map((task) => `  - ${task.ref}: ${task.title}`)
          .join('\n')
      : '  (none — leave relations as [])'

  return `You are helping bulk-create tasks for a project management app.
Reply with ONLY a JSON object — no prose, no markdown code fences.
${projectLine}
Output shape:
{
  "tasks": [
    {
      "title": "string (required)",
      "description": "string or null",
      "status": "${VALID_STATUSES.join(' | ')}",
      "priority": "${VALID_PRIORITIES.join(' | ')}",
      "assignee": "exact full name from list below, or null",
      "labels": ["exact label names from list below"],
      "dueDate": "YYYY-MM-DD or null",
      "relations": [
        { "kind": "blocked_by | blocks | parent | sub_issue | triage", "ref": "exact existing task ref" }
      ]
    }
  ]
}

Rules:
- title is required; other fields may be null or empty.
- Default status when unclear: "backlog". Default priority: "medium".
- assignee MUST come from the list below (or be null). Don't invent people.
- If an assignee is mentioned by first name only and unambiguous, use the full name from the list.
- For labels: prefer names from the list below, but new short labels (1-2 words) are OK if they genuinely fit. The user reviews them before they get created.
- For relations: only reference existing task refs from the list below. Leave the array empty if nothing relates. Use "parent" / "sub_issue" for hierarchy, "blocks" / "blocked_by" for dependency, "triage" only when the task explicitly needs categorization.
- IMPORTANT: every " quote inside a string value MUST be escaped as \\". HTML like <a href=\\"/\\"> would otherwise break the JSON parser.

Available assignees:
${memberLines}

Available labels (prefer these):
${labelLines}

Existing tasks you can relate to (by ref):
${taskLines}

My request (replace this line with what you need done):
<describe the tasks here — paragraphs, bullets, anything>
`
}

// ─── Parser ───────────────────────────────────────────────────────────────

type RelationKindLite =
  | 'blocked_by'
  | 'blocks'
  | 'parent'
  | 'sub_issue'
  | 'triage'

export type ParsedBulkTask = {
  title: string
  description: string | null
  status: TaskStatus | null
  priority: TaskPriority | null
  assigneeId: string | null
  // Raw assignee name the AI emitted — kept for display when we couldn't
  // resolve it, so the preview row can flag it.
  assigneeNameRaw: string | null
  labelIds: string[]
  // Labels the AI mentioned but we couldn't resolve — surfaced as warnings.
  unknownLabels: string[]
  dueDate: string | null
  // Resolved relations: kind + target ref. Refs the AI hallucinated end
  // up in `unknownRelations` so the preview can flag them.
  relations: { kind: RelationKindLite; ref: string }[]
  unknownRelations: { kind: string; ref: string }[]
  warnings: string[]
}

export type ParseResult =
  | { ok: true; tasks: ParsedBulkTask[] }
  | { ok: false; error: string }

export function parseBulkTaskJson(
  text: string,
  ctx: {
    members: { id: string; name: string }[]
    labels: { id: string; name: string }[]
    // Existing task refs we can validate relations against. Refs not in
    // this set become unknownRelations.
    existingTaskRefs?: string[]
  }
): ParseResult {
  const trimmed = stripCodeFences(text.trim())
  if (!trimmed) return { ok: false, error: 'Paste the AI output first.' }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(trimmed)
  } catch (e) {
    // Surface the actual parser error so users can find the bad line.
    // The single most common cause is unescaped double-quotes inside a
    // string value (e.g. HTML like <a href="/"> pasted into a title),
    // so we lead with that hint when the message points at a string.
    const detail =
      e instanceof Error ? e.message : 'unknown parse error'
    const hint = /Expected ['",}] /.test(detail)
      ? ' Often this means a string contains an unescaped " quote. Escape it as \\" or wrap the value in single quotes.'
      : ''
    return {
      ok: false,
      error: `Not valid JSON: ${detail}.${hint}`
    }
  }

  const validated = BulkTaskInputSchema.safeParse(parsedJson)
  if (!validated.success) {
    return { ok: false, error: formatZodIssues(validated.error) }
  }

  const memberByLower = new Map<string, { id: string; name: string }>()
  const memberByFirstName = new Map<string, { id: string; name: string }[]>()
  for (const m of ctx.members) {
    memberByLower.set(m.name.toLowerCase(), m)
    const first = m.name.split(/\s+/)[0]?.toLowerCase()
    if (first) {
      const list = memberByFirstName.get(first) ?? []
      list.push(m)
      memberByFirstName.set(first, list)
    }
  }
  const labelByLower = new Map<string, { id: string; name: string }>()
  for (const l of ctx.labels) labelByLower.set(l.name.toLowerCase(), l)
  const validRefs = new Set(
    (ctx.existingTaskRefs ?? []).map((r) => r.toLowerCase())
  )
  const validRelationKinds: ReadonlySet<RelationKindLite> = new Set([
    'blocked_by',
    'blocks',
    'parent',
    'sub_issue',
    'triage'
  ] as const)

  const tasks: ParsedBulkTask[] = validated.data.tasks.map((r) => {
    const warnings: string[] = []

    const status = normalizeStatus(r.status)
    if (r.status != null && r.status !== '' && status === null) {
      warnings.push(`Unknown status "${String(r.status)}" — left blank.`)
    }
    const priority = normalizePriority(r.priority)
    if (r.priority != null && r.priority !== '' && priority === null) {
      warnings.push(`Unknown priority "${String(r.priority)}" — left blank.`)
    }

    // Assignee — exact match wins, fall back to unique first-name match.
    let assigneeId: string | null = null
    let assigneeNameRaw: string | null = null
    if (r.assignee && r.assignee.trim()) {
      const raw = r.assignee.trim()
      assigneeNameRaw = raw
      const exact = memberByLower.get(raw.toLowerCase())
      if (exact) {
        assigneeId = exact.id
      } else {
        const firstMatches = memberByFirstName.get(raw.toLowerCase()) ?? []
        if (firstMatches.length === 1) {
          assigneeId = firstMatches[0].id
        } else {
          warnings.push(
            `Couldn't match assignee "${raw}" — pick one in the preview.`
          )
        }
      }
    }

    const labelIds: string[] = []
    const unknownLabels: string[] = []
    if (Array.isArray(r.labels)) {
      const seen = new Set<string>()
      for (const raw of r.labels) {
        if (!raw.trim()) continue
        const trimmedLabel = raw.trim()
        const key = trimmedLabel.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        const match = labelByLower.get(key)
        if (match) labelIds.push(match.id)
        else unknownLabels.push(trimmedLabel)
      }
    }

    const dueDate = normalizeDate(r.dueDate)
    if (r.dueDate != null && r.dueDate !== '' && dueDate === null) {
      warnings.push(
        `Couldn't parse dueDate "${String(r.dueDate)}" — left blank.`
      )
    }

    const description = r.description?.trim() ? r.description.trim() : null

    const relations: { kind: RelationKindLite; ref: string }[] = []
    const unknownRelations: { kind: string; ref: string }[] = []
    if (Array.isArray(r.relations)) {
      for (const raw of r.relations) {
        const kindRaw = (raw?.kind ?? '').trim().toLowerCase().replace(/-/g, '_')
        const refRaw = (raw?.ref ?? '').trim()
        if (!kindRaw && !refRaw) continue
        if (!validRelationKinds.has(kindRaw as RelationKindLite) || !refRaw) {
          unknownRelations.push({ kind: kindRaw, ref: refRaw })
          warnings.push(
            `Skipped relation { kind: "${kindRaw}", ref: "${refRaw}" } — unknown kind or empty ref.`
          )
          continue
        }
        if (
          validRefs.size > 0 &&
          !validRefs.has(refRaw.toLowerCase())
        ) {
          unknownRelations.push({ kind: kindRaw, ref: refRaw })
          warnings.push(
            `Skipped relation to "${refRaw}" — that ref doesn't exist.`
          )
          continue
        }
        relations.push({ kind: kindRaw as RelationKindLite, ref: refRaw })
      }
    }

    return {
      title: r.title,
      description,
      status,
      priority,
      assigneeId,
      assigneeNameRaw,
      labelIds,
      unknownLabels,
      dueDate,
      relations,
      unknownRelations,
      warnings
    }
  })

  return { ok: true, tasks }
}

function formatZodIssues(err: z.ZodError): string {
  const first = err.issues[0]
  if (!first) return 'Validation failed.'
  // err.issues[].path is an array like ["tasks", 2, "title"] — humanize to
  // "tasks[2].title" so the user can find the bad row.
  const path = first.path
    .map((seg) => (typeof seg === 'number' ? `[${seg}]` : `.${String(seg)}`))
    .join('')
    .replace(/^\./, '')
  return path ? `${path}: ${first.message}` : first.message
}

// ─── small helpers ────────────────────────────────────────────────────────

function stripCodeFences(s: string): string {
  // AIs love to wrap JSON in ```json ... ``` even when told not to.
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : s
}

function normalizeStatus(v: unknown): TaskStatus | null {
  if (typeof v !== 'string') return null
  const lower = v.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return (VALID_STATUSES as string[]).includes(lower)
    ? (lower as TaskStatus)
    : null
}

function normalizePriority(v: unknown): TaskPriority | null {
  if (typeof v !== 'string') return null
  const lower = v.trim().toLowerCase()
  return (VALID_PRIORITIES as string[]).includes(lower)
    ? (lower as TaskPriority)
    : null
}

function normalizeDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  // Accept YYYY-MM-DD exactly; reject the rest to keep behavior predictable.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return trimmed
}
