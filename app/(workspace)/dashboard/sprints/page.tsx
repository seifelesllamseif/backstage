import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { fetchInitial } from '../_components/fetchInitial'
import { panelMetadata } from '../_components/panelMetadata'
import { requireFeature } from '@/lib/features/server'

type RawSearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata = panelMetadata('Sprints')

// The shell + panel are rendered by <DashboardChrome /> in the layout.
// This page only runs the server-side redirect guard: Sprints is
// project-scoped, so without a valid ?project= we send the user back to
// /dashboard/board (preserving other filter params). The guard sits inside
// Suspense so it never blocks the panel swap.
//
// ponytail: the guard pulls the whole workspace payload (~30 queries) to
// read one field, initial.currentProjectId. Fine while it is off the
// navigation path; if it shows up in the logs, replace it with a single
// visibility-scoped projects query rather than reimplementing the scoping
// rules in supabase/dashboard/fetch.ts by hand.
export default function SprintsPage({
  searchParams
}: {
  searchParams: RawSearchParams
}) {
  return (
    <Suspense fallback={null}>
      <SprintsGuard searchParams={searchParams} />
    </Suspense>
  )
}

async function SprintsGuard({
  searchParams
}: {
  searchParams: RawSearchParams
}) {
  await requireFeature('sprints')
  const params = await searchParams
  const projectParam =
    typeof params.project === 'string' ? params.project : undefined
  const initial = await fetchInitial(projectParam)
  if (!initial.currentProjectId) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (k === 'project' || v == null) continue
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, item))
      else qs.set(k, v)
    }
    const tail = qs.toString()
    redirect(tail ? `/dashboard/board?${tail}` : '/dashboard/board')
  }
  return null
}
