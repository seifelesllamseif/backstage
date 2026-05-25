// Idempotent seeder for the /dashboard demo data.
// Run: pnpm tsx --env-file=.env.local prisma/scripts/seed-dashboard.ts
//
// Mirrors the 24 BOARD_TASKS, 10 labels, and 5 cycles that the dashboard
// used to render from hardcoded constants (see boardData.ts). Creates a
// dedicated "SKAM Series" project so the SKAM-### refs round-trip cleanly
// through createDashboardTask()'s prefix rule (project name → first word).
//
// Idempotency: if any task with a ref starting "SKAM-" already exists in
// the SKAM company, the script exits without writing. Run after pnpm db:seed.

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../lib/prisma'

// ─── Source data (was boardData.ts) ──────────────────────────────────────

type TeamKey = 'na' | 'ay' | 'mr' | 'lk' | 'em'
type DashStatus =
  | 'backlog'
  | 'unscoped'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'canceled'
  | 'duplicate'
type DashPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
type DashRelation = 'blocked_by' | 'blocks' | 'parent' | 'sub_issue' | 'triage'

interface SeedTask {
  ref: string
  title: string
  status: DashStatus
  priority: DashPriority
  assignee?: TeamKey
  tags?: string[]
  due?: string
  checklist?: { text: string; done: boolean }[]
  relations?: { kind: DashRelation; ref: string }[]
}

const TASKS: SeedTask[] = [
  {
    ref: 'SKAM-101',
    title: 'Episode 1 — final colour grade',
    status: 'in_progress',
    priority: 'urgent',
    assignee: 'na',
    tags: ['Series'],
    due: 'May 25',
    relations: [
      { kind: 'blocked_by', ref: 'SKAM-102' },
      { kind: 'sub_issue', ref: 'SKAM-107' }
    ],
    checklist: [
      { text: 'Lock color reference', done: true },
      { text: 'First pass scenes 1–4', done: true },
      { text: 'First pass scenes 5–8', done: false },
      { text: 'Director sign-off', done: false },
      { text: 'Final delivery', done: false }
    ]
  },
  {
    ref: 'SKAM-102',
    title: 'Score handoff — bridge cue v3',
    status: 'in_review',
    priority: 'high',
    assignee: 'ay',
    tags: ['Audio'],
    due: 'May 24',
    relations: [{ kind: 'blocks', ref: 'SKAM-101' }],
    checklist: [
      { text: 'Compose theme', done: true },
      { text: 'Director feedback round 1', done: true },
      { text: 'Director feedback round 2', done: false }
    ]
  },
  {
    ref: 'SKAM-103',
    title: 'Storyboard pass — opening sequence',
    status: 'done',
    priority: 'medium',
    assignee: 'em',
    tags: ['Pre-production'],
    due: 'May 18'
  },
  {
    ref: 'SKAM-104',
    title: 'Cast confirmations — supporting roles',
    status: 'todo',
    priority: 'high',
    assignee: 'lk',
    tags: ['Casting'],
    due: 'May 27',
    checklist: [
      { text: 'Reach out to agents', done: true },
      { text: 'Confirm reads', done: false },
      { text: 'Send contracts', done: false },
      { text: 'Schedule fittings', done: false }
    ]
  },
  {
    ref: 'SKAM-105',
    title: 'Location scout — Istanbul rooftops',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'mr',
    tags: ['Locations'],
    due: 'May 26'
  },
  {
    ref: 'SKAM-106',
    title: 'Sound design — episode 2 ambience',
    status: 'backlog',
    priority: 'low',
    assignee: 'ay',
    tags: ['Audio'],
    due: 'Jun 02'
  },
  {
    ref: 'SKAM-107',
    title: 'Script polish — episode 3',
    status: 'in_review',
    priority: 'medium',
    assignee: 'na',
    tags: ['Writing'],
    due: 'May 23'
  },
  {
    ref: 'SKAM-108',
    title: 'Marketing trailer cutdown — 30s',
    status: 'todo',
    priority: 'urgent',
    assignee: 'em',
    tags: ['Marketing'],
    due: 'May 22'
  },
  {
    ref: 'SKAM-109',
    title: 'Posters — alt directions',
    status: 'unscoped',
    priority: 'none',
    assignee: 'lk',
    tags: ['Design'],
    due: 'Jun 05',
    relations: [{ kind: 'parent', ref: 'SKAM-110' }]
  },
  {
    ref: 'SKAM-110',
    title: 'Press kit — final assets',
    status: 'done',
    priority: 'low',
    assignee: 'mr',
    tags: ['Marketing'],
    due: 'May 15'
  },
  {
    ref: 'SKAM-111',
    title: 'Color reference deck',
    status: 'canceled',
    priority: 'low',
    assignee: 'na',
    tags: ['Design']
  },
  {
    ref: 'SKAM-112',
    title: 'Episode 1 — final mix approval',
    status: 'todo',
    priority: 'high',
    assignee: 'ay',
    tags: ['Audio'],
    due: 'May 28'
  },
  {
    ref: 'SKAM-113',
    title: 'Episode 1 — duplicate render request',
    status: 'duplicate',
    priority: 'low',
    assignee: 'na',
    tags: ['Series'],
    relations: [{ kind: 'parent', ref: 'SKAM-101' }]
  },
  {
    ref: 'SKAM-114',
    title: 'Triage — incoming press requests',
    status: 'backlog',
    priority: 'medium',
    assignee: 'mr',
    tags: ['Marketing'],
    due: 'Jun 01'
    // 'triage' relation to INBOX is dropped — INBOX isn't a real task.
  },
  {
    ref: 'SKAM-090',
    title: 'Pilot pitch deck — final round',
    status: 'done',
    priority: 'high',
    assignee: 'na',
    tags: ['Strategy'],
    due: 'Apr 6'
  },
  {
    ref: 'SKAM-091',
    title: 'Brand guidelines v1',
    status: 'done',
    priority: 'medium',
    assignee: 'em',
    tags: ['Design'],
    due: 'Apr 4'
  },
  {
    ref: 'SKAM-092',
    title: 'Workspace IT setup',
    status: 'done',
    priority: 'low',
    assignee: 'mr',
    tags: ['Ops'],
    due: 'Apr 1'
  },
  {
    ref: 'SKAM-093',
    title: 'Casting pipeline — leads',
    status: 'done',
    priority: 'high',
    assignee: 'lk',
    tags: ['Casting'],
    due: 'Apr 5'
  },
  {
    ref: 'SKAM-094',
    title: 'Theme song — first draft',
    status: 'canceled',
    priority: 'low',
    assignee: 'ay',
    tags: ['Audio']
  },
  {
    ref: 'SKAM-095',
    title: 'Episode 1 — first cut',
    status: 'done',
    priority: 'urgent',
    assignee: 'na',
    tags: ['Series'],
    due: 'Apr 20'
  },
  {
    ref: 'SKAM-096',
    title: 'Initial location list',
    status: 'done',
    priority: 'medium',
    assignee: 'mr',
    tags: ['Locations'],
    due: 'Apr 18'
  },
  {
    ref: 'SKAM-097',
    title: 'Wardrobe direction — leads',
    status: 'done',
    priority: 'medium',
    assignee: 'em',
    tags: ['Design'],
    due: 'Apr 19'
  },
  {
    ref: 'SKAM-098',
    title: 'Episode 2 — script lock',
    status: 'done',
    priority: 'high',
    assignee: 'na',
    tags: ['Writing'],
    due: 'May 2'
  },
  {
    ref: 'SKAM-099',
    title: 'Editor — onboarding',
    status: 'done',
    priority: 'low',
    assignee: 'mr',
    tags: ['Ops'],
    due: 'May 1'
  },
  {
    ref: 'SKAM-100',
    title: 'Episode 2 — first cut',
    status: 'done',
    priority: 'urgent',
    assignee: 'na',
    tags: ['Series'],
    due: 'May 4'
  }
]

const LABELS: { name: string; color: string }[] = [
  { name: 'Series', color: 'sky' },
  { name: 'Audio', color: 'violet' },
  { name: 'Pre-production', color: 'amber' },
  { name: 'Casting', color: 'rose' },
  { name: 'Locations', color: 'emerald' },
  { name: 'Writing', color: 'indigo' },
  { name: 'Marketing', color: 'orange' },
  { name: 'Design', color: 'fuchsia' },
  { name: 'Ops', color: 'slate' },
  { name: 'Strategy', color: 'teal' }
]

interface SeedCycle {
  number: number
  name: string
  status: 'completed' | 'current' | 'upcoming'
  from: string
  to: string
  taskRefs: string[]
}

const CYCLES: SeedCycle[] = [
  {
    number: 10,
    name: 'Foundation',
    status: 'completed',
    from: 'Mar 24',
    to: 'Apr 6',
    taskRefs: ['SKAM-090', 'SKAM-091', 'SKAM-092', 'SKAM-093']
  },
  {
    number: 11,
    name: 'Pre-production',
    status: 'completed',
    from: 'Apr 7',
    to: 'Apr 20',
    taskRefs: ['SKAM-094', 'SKAM-095', 'SKAM-096', 'SKAM-097']
  },
  {
    number: 12,
    name: 'Episode 1 — Shoot',
    status: 'completed',
    from: 'Apr 21',
    to: 'May 4',
    taskRefs: ['SKAM-110', 'SKAM-103', 'SKAM-098', 'SKAM-099', 'SKAM-100']
  },
  {
    number: 13,
    name: 'Episode 1 — Post',
    status: 'current',
    from: 'May 5',
    to: 'May 28',
    taskRefs: [
      'SKAM-101',
      'SKAM-102',
      'SKAM-104',
      'SKAM-105',
      'SKAM-107',
      'SKAM-108',
      'SKAM-112',
      'SKAM-106',
      'SKAM-114',
      'SKAM-111',
      'SKAM-113',
      'SKAM-109'
    ]
  },
  {
    number: 14,
    name: 'Episode 2 — Prep',
    status: 'upcoming',
    from: 'May 29',
    to: 'Jun 11',
    taskRefs: []
  }
]

// 'na' = founder/admin, 'mr' = producer/lead, etc. Pair each demo persona with
// the closest seeded crew_member from prisma/seed.ts so role + access tier line
// up with what the hardcoded TEAM implied.
const ASSIGNEE_EMAIL: Record<TeamKey, string> = {
  na: 'iman@skam.test',
  ay: 'omar@skam.test',
  mr: 'tariq@skam.test',
  lk: 'nadia@skam.test',
  em: 'layla@skam.test'
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
}

// All seed dates are 2026 to match the BOARD_TASKS source.
function parseShortDate(input: string | undefined): Date | null {
  if (!input || input === '—') return null
  const m = input.match(/^([A-Z][a-z]{2})\s+0?(\d{1,2})$/)
  if (!m) return null
  const month = MONTHS[m[1]]
  if (month === undefined) return null
  return new Date(Date.UTC(2026, month, Number(m[2])))
}

function refToSeq(ref: string): number {
  const n = Number(ref.split('-')[1])
  if (!Number.isFinite(n)) throw new Error(`Bad ref ${ref}`)
  return n
}

export async function seedDashboard(
  db: PrismaClient,
  companyId: string
): Promise<{
  project: string
  tasks: number
  labels: number
  cycles: number
  skipped: boolean
}> {
  const existing = await db.task.findFirst({
    where: { companyId, ref: { startsWith: 'SKAM-' } },
    select: { id: true }
  })
  if (existing) {
    return { project: '', tasks: 0, labels: 0, cycles: 0, skipped: true }
  }

  const project = await db.project.upsert({
    where: { companyId_name: { companyId, name: 'SKAM Series' } },
    update: {},
    create: { companyId, name: 'SKAM Series', kind: 'standard' }
  })

  const crewRows = await db.crewMember.findMany({
    where: { companyId },
    select: { id: true, email: true }
  })
  const memberByEmail = new Map(crewRows.map((m) => [m.email, m.id]))
  const requiredEmails = Object.values(ASSIGNEE_EMAIL)
  for (const email of requiredEmails) {
    if (!memberByEmail.has(email)) {
      throw new Error(
        `Dashboard seed needs crew member ${email} (run \`pnpm db:seed\` first).`
      )
    }
  }
  const assigneeId = (key: TeamKey | undefined): string | null =>
    key ? memberByEmail.get(ASSIGNEE_EMAIL[key]) ?? null : null

  const labelByName = new Map<string, string>()
  for (const l of LABELS) {
    const row = await db.label.upsert({
      where: { companyId_name: { companyId, name: l.name } },
      update: { color: l.color },
      create: { companyId, name: l.name, color: l.color }
    })
    labelByName.set(l.name, row.id)
  }

  // Insert tasks + checklists + label joins. Refs are unique within the
  // project, so we can use them as the lookup key for the relations pass.
  const taskIdByRef = new Map<string, string>()
  for (const t of TASKS) {
    const created = await db.task.create({
      data: {
        companyId,
        projectId: project.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        ref: t.ref,
        seqNumber: refToSeq(t.ref),
        assigneeId: assigneeId(t.assignee),
        dueDate: parseShortDate(t.due),
        labels: t.tags?.length
          ? {
              create: t.tags
                .map((name) => labelByName.get(name))
                .filter((id): id is string => Boolean(id))
                .map((labelId) => ({ labelId }))
            }
          : undefined,
        checklist: t.checklist?.length
          ? {
              create: t.checklist.map((c, i) => ({
                text: c.text,
                isDone: c.done,
                sortOrder: i
              }))
            }
          : undefined
      },
      select: { id: true, ref: true }
    })
    if (created.ref) taskIdByRef.set(created.ref, created.id)
  }

  // Second pass: dependencies (need both endpoints to exist).
  const depRows: Prisma.TaskDependencyCreateManyInput[] = []
  for (const t of TASKS) {
    if (!t.relations?.length) continue
    const fromId = taskIdByRef.get(t.ref)
    if (!fromId) continue
    for (const r of t.relations) {
      const toId = taskIdByRef.get(r.ref)
      if (!toId) continue
      depRows.push({
        companyId,
        taskId: fromId,
        dependsOnTaskId: toId,
        kind: r.kind
      })
    }
  }
  if (depRows.length) {
    await db.taskDependency.createMany({
      data: depRows,
      skipDuplicates: true
    })
  }

  // Cycles + cycle_task joins.
  for (const c of CYCLES) {
    const cycle = await db.cycle.upsert({
      where: { projectId_number: { projectId: project.id, number: c.number } },
      update: {
        name: c.name,
        status: c.status,
        fromDate: parseShortDate(c.from)!,
        toDate: parseShortDate(c.to)!
      },
      create: {
        companyId,
        projectId: project.id,
        number: c.number,
        name: c.name,
        status: c.status,
        fromDate: parseShortDate(c.from)!,
        toDate: parseShortDate(c.to)!
      }
    })
    const joinRows = c.taskRefs
      .map((ref) => taskIdByRef.get(ref))
      .filter((id): id is string => Boolean(id))
      .map((taskId) => ({ cycleId: cycle.id, taskId }))
    if (joinRows.length) {
      await db.cycleTask.createMany({ data: joinRows, skipDuplicates: true })
    }
  }

  return {
    project: project.name,
    tasks: TASKS.length,
    labels: LABELS.length,
    cycles: CYCLES.length,
    skipped: false
  }
}

async function main(): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { slug: 'skam' },
    select: { id: true, name: true }
  })
  if (!company) {
    console.error(
      'Dashboard seed aborted: no SKAM company. Run `pnpm db:seed` first.'
    )
    process.exit(1)
  }

  console.log(`Seeding dashboard demo data into ${company.name}…`)
  const result = await seedDashboard(prisma, company.id)

  if (result.skipped) {
    console.log('Skipped — SKAM-### tasks already exist.')
    return
  }
  console.log(
    `Done. Project "${result.project}", ${result.tasks} tasks, ${result.labels} labels, ${result.cycles} cycles.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
