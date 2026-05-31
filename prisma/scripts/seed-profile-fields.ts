// Patch profile fields on the six Verbivore members in an already-seeded DB.
// Idempotent: skips members whose bio is already populated.
//
// Run: pnpm tsx --env-file=.env.local prisma/scripts/seed-profile-fields.ts
//
// See docs/decisions/0018-profile-pages.md.

import { createClient } from '@supabase/supabase-js'
import { seedProfileFields } from '../profile-data'
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

  console.log(`Patching profile fields into ${company.name}...`)
  const result = await seedProfileFields(supabase, company.id)
  console.log(
    `Done. ${result.updated} member${result.updated === 1 ? '' : 's'} updated, ${result.skipped} already populated, ${result.missing} not found.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
