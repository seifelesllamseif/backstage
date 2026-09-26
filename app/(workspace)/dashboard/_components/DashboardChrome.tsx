'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
// skeleton). Switching projects keeps the previous data on screen while the
// new project's data loads, so the shell never falls back to the skeleton
// once the first fetch has succeeded.

// Every /dashboard/* URL target. The tabs and the sidebar navigate with
// router.push (they're buttons, not links), and router.push does not
// prefetch - so without this warm-up the router has to round-trip to the
// server on the first click of each panel, even though the destination page
// renders `null` and the data is already in the React Query cache. Prefetch
// happens once on mount, off the critical path.
//
// ponytail: plain list rather than derived from PANEL_VIEWS in
// DashboardShell, which covers the sidebar panels but not the tabs. A new
// panel missing from here is not a bug, just one un-warmed first click.
const PANEL_ROUTES = [
  'board',
  'list',
  'timeline',
  'sprints',
  'meetings',
  'projects',
  'updates',
  'settings',
  'symbols',
  'team',
  'archive',
  'trash',
  'onboarding',
  'marketplace'
]

export function DashboardChrome() {
  const params = useSearchParams()
  const router = useRouter()
  const project = params.get('project') ?? undefined

  const { data } = useQuery({
    queryKey: ['dashboardInitial', project ?? null],
    queryFn: () => fetchInitial(project),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false
  })

  useEffect(() => {
    for (const seg of PANEL_ROUTES) router.prefetch(`/dashboard/${seg}`)
  }, [router])

  if (!data) return <DashboardSkeleton />
  return <DashboardShell initial={data} />
}
