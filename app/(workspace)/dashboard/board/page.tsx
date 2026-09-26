import { panelMetadata } from '../_components/panelMetadata'

export const metadata = panelMetadata('Board')

// The shell + panel are rendered by <DashboardChrome /> in the layout.
// This route exists only as a URL target; the chrome reads usePathname()
// to render the Board panel.
export default function BoardPage() {
  return null
}
