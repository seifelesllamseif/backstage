'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import DashboardShell from './DashboardShell'
import DashboardSkeleton from './DashboardSkeleton'
import { fetchInitial } from '../actions'

// Mounts the dashboard shell once at the layout level and keeps it mounted
// across every tab/panel route under /dashboard/*. Tab navigation only
// changes the URL pathname (which DashboardShell reads via usePathname to
// pick which panel to render); the chrome (sidebar + topbar + modals) never
// unmounts.
//
// Data fetch goes through React Query keyed on the project search param, so
// switching tabs within the same project is a cache hit (instant, no
// skeleton). Switching projects refetches.

export function DashboardChrome() {
  const params = useSearchParams()
  const project = params.get('project') ?? undefined

  const { data } = useQuery({
    queryKey: ['dashboardInitial', project ?? null],
    queryFn: () => fetchInitial(project),
    // Poll while the tab is foregrounded so edits from teammates land
    // without a manual refresh. Background tabs skip the poll and pick
    // changes up on the existing window-focus refetch.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false
  })

  if (!data) return <DashboardSkeleton />
  return <DashboardShell initial={data} />
}
