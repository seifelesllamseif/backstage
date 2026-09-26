'use client'

import { useState, type ComponentType } from 'react'

// Plain links have no hand-drawn brand icon, so show the site's own.
//
// Fetched by the viewer's browser straight from that site - no favicon
// service in between collecting every URL a workspace links to - and with
// no-referrer, so the site doesn't learn this workspace's address either.
// Anything that doesn't decode as an image (no /favicon.ico, an HTML 404,
// a site that blocks hotlinking) falls back to the generic icon.
//
// ponytail: /favicon.ico only. Measured 17/25 common sites (YouTube, Google
// Docs, Linear, Slack, Canva...); the misses (Notion, Loom, Dropbox) declare
// their icon in <link rel="icon"> instead. Reaching those means fetching the
// page server-side - addTaskExternalRef already does, for scrapeDocTitle -
// and storing the icon URL on the ref. Do that if the chain icon shows up
// too often; mind that it's a server fetching user-supplied URLs.
export function Favicon({
  url,
  fallback: Fallback,
  className
}: {
  url: string
  fallback: ComponentType<{ className?: string }>
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  let host: string | null = null
  try {
    host = new URL(url).host
  } catch {}
  if (!host || failed) return <Fallback className={className} />
  return (
    // Plain <img>: the host can be anything, and next/image would need each
    // one allow-listed in next.config.
    <img
      src={`https://${host}/favicon.ico`}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
