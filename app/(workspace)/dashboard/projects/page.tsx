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

export default function ProjectsPage() {
  return null
}
