export type ExternalRefKind =
  | 'issue'
  | 'pr'
  | 'commit'
  | 'doc'
  | 'link'
  | 'supabase'
  | 'github'
  | 'figma'
  | 'verbivore'
  | 'vercel'
  | 'bunny'
  | 'sentry'
  | 'gcloud'
  | 'stripe'

export interface ParsedExternalRef {
  kind: ExternalRefKind
  url: string
  repo?: string
  // For supabase refs: the project ref (e.g. "nkvgvfdmtvdabtpppanj")
  identifier?: string
}

const DOC_HOSTS = new Set([
  'docs.google.com',
  'drive.google.com',
  'www.notion.so',
  'notion.so'
])

export function parseExternalRef(rawUrl: string): ParsedExternalRef | null {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const normalized = url.toString()
  const host = url.hostname.toLowerCase()

  if (host === 'github.com' || host === 'www.github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 4) {
      const [owner, repo, section, ...rest] = parts
      const idRaw = rest[0] ?? ''
      const repoSlug = `${owner}/${repo}`
      if (section === 'pull') {
        return {
          kind: 'pr',
          url: normalized,
          repo: repoSlug,
          identifier: idRaw
        }
      }
      if (section === 'issues') {
        return {
          kind: 'issue',
          url: normalized,
          repo: repoSlug,
          identifier: idRaw
        }
      }
      if (section === 'commit') {
        return {
          kind: 'commit',
          url: normalized,
          repo: repoSlug,
          identifier: idRaw.slice(0, 7)
        }
      }
      if (section === 'wiki' || section === 'discussions') {
        return { kind: 'doc', url: normalized, repo: repoSlug }
      }
    }
    // Bare repo URL (https://github.com/owner/repo or shorter) - any
    // github.com URL that didn't match a specific section above.
    const parts2 = url.pathname.split('/').filter(Boolean)
    const repoSlug =
      parts2.length >= 2 ? `${parts2[0]}/${parts2[1]}` : undefined
    return {
      kind: 'github',
      url: normalized,
      repo: repoSlug,
      identifier: repoSlug
    }
  }

  // Figma: any figma.com URL (file, prototype, board, etc.)
  // URL shape: /<kind>/<fileKey>/<fileName>?... where <kind> is one of
  // design, file, proto, board, slides. Capture the file name as the
  // identifier so the chip reads "Figma · <FileName>" instead of bare.
  if (host === 'figma.com' || host === 'www.figma.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const FIGMA_SECTIONS = new Set([
      'design',
      'file',
      'proto',
      'board',
      'slides'
    ])
    let fileName: string | undefined
    if (parts.length >= 3 && FIGMA_SECTIONS.has(parts[0].toLowerCase())) {
      try {
        fileName = decodeURIComponent(parts[2])
      } catch {
        fileName = parts[2]
      }
    }
    return { kind: 'figma', url: normalized, identifier: fileName }
  }

  // Verbivore: the project's own properties. Catches the marketing site,
  // the learn subdomain, the staging/dev hosts, etc. Identifier is the
  // hostname so the chip can render "learn.verbivore.app" or similar.
  if (
    host === 'verbivore.app' ||
    host === 'verbivore.com' ||
    host.endsWith('.verbivore.app') ||
    host.endsWith('.verbivore.com')
  ) {
    return { kind: 'verbivore', url: normalized, identifier: host }
  }

  // Vercel: project dashboards live at vercel.com/<team>/<project>. We
  // surface the project slug as the identifier (e.g. "lms-2"). Deployment
  // and other paths fall back to just "Vercel".
  if (host === 'vercel.com' || host === 'www.vercel.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const project = parts.length >= 2 ? parts[1] : undefined
    return { kind: 'vercel', url: normalized, identifier: project }
  }

  // Sentry: <org>.sentry.io. The org slug lives in the subdomain (e.g.
  // verbivore.sentry.io -> "verbivore"). Plain sentry.io URLs fall back
  // to "Sentry" with no identifier.
  if (host === 'sentry.io' || host === 'www.sentry.io') {
    return { kind: 'sentry', url: normalized }
  }
  if (host.endsWith('.sentry.io')) {
    const org = host.split('.')[0]
    return { kind: 'sentry', url: normalized, identifier: org }
  }

  // Google Cloud Console: console.cloud.google.com/...?project=<name>.
  // Identifier is the project param when present; covers the welcome page
  // as well as deep links into specific services.
  if (
    host === 'console.cloud.google.com' ||
    host === 'cloud.google.com' ||
    host === 'console.developers.google.com'
  ) {
    const project = url.searchParams.get('project') ?? undefined
    return { kind: 'gcloud', url: normalized, identifier: project }
  }

  // Stripe dashboard: dashboard.stripe.com/acct_<id>/... The account id is
  // the canonical identifier. Plain dashboard.stripe.com or stripe.com
  // URLs without an account fall back to "Stripe" with no identifier.
  if (host === 'dashboard.stripe.com' || host === 'stripe.com' ||
      host === 'www.stripe.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const acct = parts.find((p) => p.startsWith('acct_'))
    // Strip "acct_" prefix for display; the URL keeps the full form.
    const id = acct ? acct.replace(/^acct_/, '') : undefined
    return { kind: 'stripe', url: normalized, identifier: id }
  }

  // Bunny.net: dash + cdn surfaces. Catches dash.bunny.net (admin panel),
  // bunnycdn.com (legacy), and *.b-cdn.net (CDN hosts). Identifier is the
  // storage zone id or pull zone id when we can read it from the path.
  if (
    host === 'dash.bunny.net' ||
    host === 'bunny.net' ||
    host === 'www.bunny.net' ||
    host === 'bunnycdn.com' ||
    host.endsWith('.b-cdn.net')
  ) {
    let id: string | undefined
    if (host === 'dash.bunny.net') {
      const parts = url.pathname.split('/').filter(Boolean)
      // /storage/<id>/... or /cdn/<id>/...
      if (parts.length >= 2 && (parts[0] === 'storage' || parts[0] === 'cdn')) {
        id = parts[1]
      }
    } else if (host.endsWith('.b-cdn.net')) {
      id = host.replace('.b-cdn.net', '')
    }
    return { kind: 'bunny', url: normalized, identifier: id }
  }

  if (DOC_HOSTS.has(host)) {
    return { kind: 'doc', url: normalized }
  }

  if (url.pathname.toLowerCase().endsWith('.md')) {
    return { kind: 'doc', url: normalized }
  }

  // Supabase URLs: project dashboard, REST endpoint, or any *.supabase.co
  // subdomain. Captures the project ref so the chip can display it.
  // Examples:
  //   https://supabase.com/dashboard/project/<ref>  - project dashboard
  //   https://supabase.com/dashboard/project/<ref>/editor
  //   https://<ref>.supabase.co                     - API base
  //   https://<ref>.supabase.co/storage/v1/...      - storage url
  if (host === 'supabase.com' || host === 'www.supabase.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const projectIdx = parts.indexOf('project')
    const ref =
      projectIdx >= 0 && parts.length > projectIdx + 1
        ? parts[projectIdx + 1]
        : undefined
    return { kind: 'supabase', url: normalized, identifier: ref }
  }
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.in')) {
    const ref = host.split('.')[0]
    return { kind: 'supabase', url: normalized, identifier: ref }
  }

  return { kind: 'link', url: normalized }
}

export function defaultExternalRefLabel(parsed: ParsedExternalRef): string {
  if (parsed.kind === 'pr' && parsed.identifier)
    return `PR #${parsed.identifier}`
  if (parsed.kind === 'issue' && parsed.identifier)
    return `#${parsed.identifier}`
  if (parsed.kind === 'commit' && parsed.identifier)
    return `commit ${parsed.identifier}`
  // Unified "Brand · identifier" format for all brand kinds. Falls back to
  // just the brand name when no identifier is available.
  if (parsed.kind === 'supabase') {
    return parsed.identifier ? `Supabase · ${parsed.identifier}` : 'Supabase'
  }
  if (parsed.kind === 'github') {
    return parsed.identifier ? `GitHub · ${parsed.identifier}` : 'GitHub'
  }
  if (parsed.kind === 'figma') {
    return parsed.identifier ? `Figma · ${parsed.identifier}` : 'Figma'
  }
  if (parsed.kind === 'verbivore') {
    return parsed.identifier ? `Verbivore · ${parsed.identifier}` : 'Verbivore'
  }
  if (parsed.kind === 'vercel') {
    return parsed.identifier ? `Vercel · ${parsed.identifier}` : 'Vercel'
  }
  if (parsed.kind === 'bunny') {
    return parsed.identifier ? `Bunny · ${parsed.identifier}` : 'Bunny'
  }
  if (parsed.kind === 'sentry') {
    return parsed.identifier ? `Sentry · ${parsed.identifier}` : 'Sentry'
  }
  if (parsed.kind === 'gcloud') {
    return parsed.identifier
      ? `Google Cloud · ${parsed.identifier}`
      : 'Google Cloud'
  }
  if (parsed.kind === 'stripe') {
    return parsed.identifier ? `Stripe · ${parsed.identifier}` : 'Stripe'
  }
  if (parsed.kind === 'doc') {
    try {
      const u = new URL(parsed.url)
      const host = u.hostname.replace(/^www\./, '')
      if (host === 'docs.google.com') return 'Google Docs'
      if (host === 'drive.google.com') return 'Google Drive'
      if (host === 'notion.so') return 'Notion'
      return host
    } catch {
      return 'doc'
    }
  }
  try {
    const u = new URL(parsed.url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.toLowerCase()
    if (host === 'resend.com' || host.endsWith('.resend.com')) return 'Resend'
    if (host === 'godaddy.com' || host.endsWith('.godaddy.com')) return 'GoDaddy'
    if (
      host === 'wordpress.com' ||
      host.endsWith('.wordpress.com') ||
      host.endsWith('.wp.com') ||
      path.startsWith('/wp-admin') ||
      path.includes('/wp-content/') ||
      path === '/wp-login.php'
    ) {
      return 'WordPress'
    }
    return host
  } catch {
    return parsed.url
  }
}
