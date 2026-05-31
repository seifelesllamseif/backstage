import type { Metadata } from 'next'
import { dashboardMetadata } from '../_components/fetchInitial'

type SearchParams = Promise<{ project?: string }>

export async function generateMetadata({
  searchParams
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const { project } = await searchParams
  return dashboardMetadata(project)
}

// The shell + panel are rendered by <DashboardChrome /> in the layout.
// This route exists only as a URL target; the chrome reads usePathname()
// to render the Board panel.
export default function BoardPage() {
  return null
}
