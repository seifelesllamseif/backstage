import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { DEFAULT_LOGIN_ROUTE } from '@/routes'
import { slugify } from '@/lib/slug'

// Bare /portfolio is the sidebar's "my profile" entry. Reads the session
// cookie to discover the signed-in user's slug, then forwards to /[slug]
// (decision 0031). Cookie read lives inside the Suspense boundary so
// cacheComponents can prerender the (empty) shell while the redirect resolves.
export default function PortfolioRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToOwnSlug />
    </Suspense>
  )
}

async function RedirectToOwnSlug() {
  const supabase = await createClient()
  const { data: claimsRes } = await supabase.auth.getClaims()
  const userId = claimsRes?.claims?.sub
  if (!userId) redirect(DEFAULT_LOGIN_ROUTE)

  const { data: me } = await supabase
    .from('team_members')
    .select('slug, full_name, email')
    .eq('id', userId)
    .maybeSingle()
  if (!me) {
    throw new Error('No team_member row for the current auth user.')
  }

  const handle = me.slug ?? slugify(me.full_name, me.email)
  redirect(`/${handle}`)
  return null
}
