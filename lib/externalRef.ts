export type ExternalRefKind = 'issue' | 'pr' | 'commit' | 'doc' | 'link'

export interface ParsedExternalRef {
  kind: ExternalRefKind
  url: string
  repo?: string
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
  }

  if (DOC_HOSTS.has(host)) {
    return { kind: 'doc', url: normalized }
  }

  if (url.pathname.toLowerCase().endsWith('.md')) {
    return { kind: 'doc', url: normalized }
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
