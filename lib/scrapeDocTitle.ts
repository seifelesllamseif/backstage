import 'server-only'

const ALLOWED_HOSTS = new Set([
  'docs.google.com',
  'drive.google.com',
  'notion.so',
  'www.notion.so'
])

const FETCH_TIMEOUT_MS = 3000
const MAX_BYTES = 64 * 1024

const TRAILING_SUFFIXES = [
  ' - Google Docs',
  ' - Google Sheets',
  ' - Google Slides',
  ' - Google Drive'
]

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
}

// Best-effort title fetch for a public doc URL. Returns null on any failure
// (private doc, network error, parse miss). The list of allowed hosts is
// the only SSRF guard — never widen it to user-supplied hosts.
export async function scrapeDocTitle(rawUrl: string): Promise<string | null> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Backstage/1.0 (link-preview)',
        accept: 'text/html'
      }
    })
    if (!res.ok || !res.body) return null

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let html = ''
    let bytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      html += decoder.decode(value, { stream: true })
      if (/<\/title>/i.test(html) || bytes >= MAX_BYTES) {
        reader.cancel().catch(() => {})
        break
      }
    }

    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!match) return null
    let title = decodeEntities(match[1]).trim().replace(/\s+/g, ' ')
    for (const suffix of TRAILING_SUFFIXES) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length).trim()
        break
      }
    }
    if (!title || title.length > 200) return null
    if (title.toLowerCase() === 'google docs') return null
    return title
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
