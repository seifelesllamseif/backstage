// Type-only barrel for the dashboard. Lives separately from actions.ts
// because Next.js's `'use server'` files can only export async functions
// (so type exports / non-async re-exports must live elsewhere).
//
// Consumers import dashboard *types* from here and dashboard *actions*
// from `./actions`.

import type { fetchDashboardData } from '@/supabase/dashboard/fetch'

export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>
export type DashboardTask = DashboardData['tasks'][number]
export type DashboardMember = DashboardData['members'][number]
export type DashboardProject = DashboardData['projects'][number]

export type { StatusChangeResult, RenameProjectState } from '@/supabase/dashboard/mutations'
