import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'
import { slugify } from '../lib/slug'
import { seedSlice2Handoffs } from './slice-2-handoffs'
import { seedProfileFields } from './profile-data'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEV_PASSWORD = 'AStrong1!'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Seed aborted: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket }
})

type AccessTier = 'admin' | 'lead' | 'member'

type SeedPerson = {
  email: string
  contactEmail: string
  fullName: string
  tier: AccessTier
  role: string
}

const PEOPLE: readonly SeedPerson[] = [
  {
    email: 'iona.douglas@verbivore.app',
    contactEmail: 'ionadouglas02@gmail.com',
    fullName: 'Iona Douglas',
    tier: 'admin',
    role: 'founder'
  },
  {
    email: 'seifelesllam.seif@verbivore.app',
    contactEmail: 'seifsaif@gmail.com',
    fullName: 'Seifelesllam Seif',
    tier: 'lead',
    role: 'full-stack'
  },
  {
    email: 'maryam.baig@verbivore.app',
    contactEmail: 'maryambaig105@gmail.com',
    fullName: 'Maryam Baig',
    tier: 'lead',
    role: 'full-stack'
  },
  {
    email: 'asim.selim@verbivore.app',
    contactEmail: 'selimasim9@gmail.com',
    fullName: 'Asim Selim',
    tier: 'member',
    role: 'ui/ux'
  },
  {
    email: 'oheneba.bosompem@verbivore.app',
    contactEmail: 'bosompemoheneba@gmail.com',
    fullName: 'Oheneba Bosompem',
    tier: 'member',
    role: 'frontend'
  },
  {
    email: 'corentin.boissie@verbivore.app',
    contactEmail: 'corentin.boissie14@gmail.com',
    fullName: 'Corentin Boissié',
    tier: 'member',
    role: 'cybersecurity'
  },
  {
    email: 'radmila.tantaeva@verbivore.app',
    contactEmail: 'radmila.tantaeva4@gmail.com',
    fullName: 'Radmila Tantaeva',
    tier: 'member',
    role: 'transcription'
  }
]

function daysFromToday(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function toDateOnly(d: Date | null): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

async function main(): Promise<void> {
  const { data: existing, error: existingErr } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', 'verbivore')
    .maybeSingle()
  if (existingErr) {
    console.error(`Seed aborted: failed to check existing company: ${existingErr.message}`)
    process.exit(1)
  }
  if (existing) {
    console.error('Seed aborted: company "verbivore" already exists. Truncate the public schema and retry.')
    process.exit(1)
  }

  console.log('Creating company Verbivore...')
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({ name: 'Verbivore', slug: 'verbivore' })
    .select('id')
    .single()
  if (companyErr || !company) {
    throw new Error(`Failed to create company: ${companyErr?.message ?? 'no data returned'}`)
  }
  const companyId = company.id as string

  console.log(`Creating ${PEOPLE.length} auth users + matching team_member rows...`)
  const idByEmail = new Map<string, string>()
  const teamMemberRows: Array<Record<string, unknown>> = []
  for (const p of PEOPLE) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.fullName }
    })
    if (error || !data.user) {
      throw new Error(
        `Failed to create auth user for ${p.email}: ${error?.message ?? 'unknown error'}`
      )
    }
    teamMemberRows.push({
      id: data.user.id,
      company_id: companyId,
      email: p.email,
      contact_email: p.contactEmail,
      slug: slugify(p.fullName, p.email),
      full_name: p.fullName,
      access_tier: p.tier
    })
    idByEmail.set(p.email, data.user.id)
  }
  const { error: tmErr } = await supabase.from('team_members').insert(teamMemberRows)
  if (tmErr) throw new Error(`Failed to insert team_members: ${tmErr.message}`)

  console.log('Creating 2 projects (Operations + Pilot Episode)...')
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .insert([
      { company_id: companyId, name: 'Operations', kind: 'operations' },
      { company_id: companyId, name: 'Pilot Episode', kind: 'standard' }
    ])
    .select('id, name')
  if (projErr || !projects || projects.length !== 2) {
    throw new Error(`Failed to create projects: ${projErr?.message ?? 'unexpected result'}`)
  }
  const opsProj = projects.find((p) => p.name === 'Operations')
  const pilotProj = projects.find((p) => p.name === 'Pilot Episode')
  if (!opsProj || !pilotProj) throw new Error('Project lookup missing after insert')
  const opsId = opsProj.id as string
  const pilotId = pilotProj.id as string

  const id = (email: string): string => {
    const v = idByEmail.get(email)
    if (!v) throw new Error(`No seeded user for ${email}`)
    return v
  }

  type SeedTask = {
    projectId: string
    title: string
    status:
      | 'backlog'
      | 'unscoped'
      | 'todo'
      | 'in_progress'
      | 'in_review'
      | 'done'
      | 'canceled'
    assigneeId: string | null
    dueDate: Date | null
    createdBy: string
  }

  const tasks: SeedTask[] = [
    {
      projectId: pilotId,
      title: 'Write episode 1 outline',
      status: 'done',
      assigneeId: id('maryam.baig@verbivore.app'),
      dueDate: daysFromToday(-5),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Cast lead role',
      status: 'in_review',
      assigneeId: id('radmila.tantaeva@verbivore.app'),
      dueDate: daysFromToday(3),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Design opening titles',
      status: 'in_progress',
      assigneeId: id('oheneba.bosompem@verbivore.app'),
      dueDate: daysFromToday(7),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Record location ambience',
      status: 'todo',
      assigneeId: id('corentin.boissie@verbivore.app'),
      dueDate: daysFromToday(14),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Storyboard cold open',
      status: 'in_progress',
      assigneeId: id('oheneba.bosompem@verbivore.app'),
      dueDate: daysFromToday(-2),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Hire DP',
      status: 'in_progress',
      assigneeId: id('iona.douglas@verbivore.app'),
      dueDate: daysFromToday(10),
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Lock script for ep 1',
      status: 'in_review',
      assigneeId: id('maryam.baig@verbivore.app'),
      dueDate: daysFromToday(1),
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: pilotId,
      title: 'Scout primary location',
      status: 'backlog',
      assigneeId: null,
      dueDate: null,
      createdBy: id('iona.douglas@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Set up shared Drive structure',
      status: 'done',
      assigneeId: id('asim.selim@verbivore.app'),
      dueDate: daysFromToday(-7),
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Onboard new intern',
      status: 'todo',
      assigneeId: id('iona.douglas@verbivore.app'),
      dueDate: daysFromToday(2),
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Renew studio insurance',
      status: 'todo',
      assigneeId: id('asim.selim@verbivore.app'),
      dueDate: daysFromToday(30),
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Pay invoices for camera rental',
      status: 'in_progress',
      assigneeId: id('asim.selim@verbivore.app'),
      dueDate: daysFromToday(-1),
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Update equipment inventory',
      status: 'backlog',
      assigneeId: null,
      dueDate: null,
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Plan Q3 team offsite',
      status: 'unscoped',
      assigneeId: null,
      dueDate: null,
      createdBy: id('asim.selim@verbivore.app')
    },
    {
      projectId: opsId,
      title: 'Cancel old SaaS subscriptions',
      status: 'canceled',
      assigneeId: id('iona.douglas@verbivore.app'),
      dueDate: null,
      createdBy: id('asim.selim@verbivore.app')
    }
  ]

  console.log(`Creating ${tasks.length} tasks...`)
  const { error: taskErr } = await supabase.from('tasks').insert(
    tasks.map((t) => ({
      company_id: companyId,
      project_id: t.projectId,
      title: t.title,
      status: t.status,
      assignee_id: t.assigneeId,
      due_date: toDateOnly(t.dueDate),
      created_by: t.createdBy
    }))
  )
  if (taskErr) throw new Error(`Failed to insert tasks: ${taskErr.message}`)

  console.log('Creating slice-2 handoff samples...')
  const handoffs = await seedSlice2Handoffs(supabase, companyId)

  console.log('Filling profile fields (bio, socials, languages)...')
  const profiles = await seedProfileFields(supabase, companyId)

  console.log('')
  console.log(
    `Seeded Verbivore - ${PEOPLE.length} people, 2 projects, ${tasks.length} tasks, ${handoffs.inserted} handoffs, ${profiles.updated} profile patches.`
  )
  console.log('')
  console.log(`Login password (all users): ${DEV_PASSWORD}`)
  console.log('')
  console.log('  tier    email                          name')
  console.log(
    '  ------- ------------------------------ ---------------------------'
  )
  for (const p of PEOPLE) {
    console.log(
      `  ${p.tier.padEnd(7)} ${p.email.padEnd(30)} ${p.fullName} (${p.role})`
    )
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
