// Detects what kind of artifact a URL points to, so the task detail panel
// can render the right icon and the server can persist the right enum
// value. Shared between client (display) and server (validation). Only
// rule-of-thumb classification — we don't fetch the URL.
//
// Recognized:
//   - GitHub PR     → /<owner>/<repo>/pull/<n>
//   - GitHub issue  → /<owner>/<repo>/issues/<n>
//   - GitHub commit → /<owner>/<repo>/commit/<sha>
//   - Docs          → docs.google.com, *.notion.so, GitHub wiki, *.md
//   - Anything else → 'link'

export type ExternalRefKind = 'issue' | 'pr' | 'commit' | 'doc' | 'link'

export interface ParsedExternalRef {
  kind: ExternalRefKind
  url: string
  // Repo if GitHub URL (owner/name). Used to short-label PR / issue chips.
  repo?: string
  // Issue/PR number or short commit hash. Used for default chip label.
  identifier?: string
}

const DOC_HOSTS = new Set([
  'docs.google.com',
  'drive.google.com',
  'www.notion.so',
  'notion.so',
  'www.figma.com',
  'figma.com'
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

  // GitHub paths: /<owner>/<repo>/(pull|issues|commit)/<id>
  if (host === 'github.com' || host === 'www.github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 4) {
      const [owner, repo, section, ...rest] = parts
      const idRaw = rest[0] ?? ''
      const repoSlug = `${owner}/${repo}`
      if (section === 'pull') {
        return { kind: 'pr', url: normalized, repo: repoSlug, identifier: idRaw }
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
  }

  // Known doc hosts → doc.
  if (DOC_HOSTS.has(host)) {
    return { kind: 'doc', url: normalized }
  }

  // Markdown files anywhere → doc.
  if (url.pathname.toLowerCase().endsWith('.md')) {
    return { kind: 'doc', url: normalized }
  }

  return { kind: 'link', url: normalized }
}

// Default chip label for an unlabeled ref. The server stores label as null
// when the user didn't override; the client renders this fallback so it
// stays in one place.
export function defaultExternalRefLabel(parsed: ParsedExternalRef): string {
  if (parsed.kind === 'pr' && parsed.identifier) return `PR #${parsed.identifier}`
  if (parsed.kind === 'issue' && parsed.identifier)
    return `#${parsed.identifier}`
  if (parsed.kind === 'commit' && parsed.identifier)
    return `commit ${parsed.identifier}`
  if (parsed.kind === 'doc') {
    try {
      const u = new URL(parsed.url)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return 'doc'
    }
  }
  try {
    const u = new URL(parsed.url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return parsed.url
  }
}
