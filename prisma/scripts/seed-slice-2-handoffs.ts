// Idempotent slice-2 handoff seeder for an already-seeded DB.
// Run: pnpm tsx --env-file=.env.local prisma/scripts/seed-slice-2-handoffs.ts
//
// Looks up the Verbivore company, then inserts handoffs for the four sample
// tasks by title. Skips any task that already has a handoff. Safe to re-run.
// See docs/decisions/0015-slice-2-handoff-architecture.md.

import { createClient } from '@supabase/supabase-js'
import { seedSlice2Handoffs } from '../slice-2-handoffs'
import type { Database } from '../../supabase/types'

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use --env-file=.env.local.'
    )
    process.exit(1)
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('slug', 'verbivore')
    .maybeSingle()
  if (error) {
    console.error('Company lookup failed:', error.message)
    process.exit(1)
  }
  if (!company) {
    console.error(
      'Patch aborted: no Verbivore company. Run `pnpm db:seed` first to set up slice-1 data.'
    )
    process.exit(1)
  }

  console.log(`Patching slice-2 handoffs into ${company.name}...`)
  const result = await seedSlice2Handoffs(supabase, company.id)
  console.log(
    `Done. ${result.inserted} handoff${result.inserted === 1 ? '' : 's'} inserted, ${result.skipped} already present, ${result.missing} target task${result.missing === 1 ? '' : 's'} not found.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
