import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { dashboardMetadata, fetchInitial } from '../_components/fetchInitial'

type RawSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

export async function generateMetadata({
  searchParams
}: {
  searchParams: RawSearchParams
}): Promise<Metadata> {
  const params = await searchParams
  const project =
    typeof params.project === 'string' ? params.project : undefined
  return dashboardMetadata(project)
}

// The shell + panel are rendered by <DashboardChrome /> in the layout.
// This page only runs the server-side redirect guard: Sprints is
// project-scoped, so without a valid ?project= we send the user back to
// /dashboard/board (preserving other filter params).
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
