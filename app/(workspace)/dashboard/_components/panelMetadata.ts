import type { Metadata } from 'next'
import { config } from '@/lib/config'

// Static per-panel metadata for the /dashboard/* route targets.
//
// Deliberately takes no searchParams and touches no database. Awaiting
// searchParams (or params, or a DB read) inside generateMetadata makes the
// route dynamic, and a dynamic route costs a server round trip on every
// single tab click - for pages that render `null`, because the real UI lives
// in <DashboardChrome /> up in the layout. Static metadata keeps these
// routes prerenderable, which is what lets Next prefetch them and swap
// panels with no network at all.
//
// The active project name used to be spliced into the title here, at the
// price of two Frankfurt round trips per navigation. DashboardShell now
// appends it client-side via document.title instead.
export function panelMetadata(label: string): Metadata {
  return {
    title: `${label} · ${config.appName}`,
    description: 'Hand off, receive and track tasks across the team.'
  }
}
