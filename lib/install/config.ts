// Editing plugins.config.ts / plugins.config.server.ts as text.
//
// Installing a plugin is "add the folder, add two lines, redeploy" (see
// PLUGINS.md). The two lines are what this file produces. Kept pure and
// string-only so it is testable without a repo, and so a malformed config
// fails loudly here rather than producing a file that will not compile on
// Vercel ten seconds later.

// Plugin ids are kebab-case; import identifiers cannot be. 'my-plugin' -> 'myPlugin'.
export function identifierFor(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export function isValidPluginId(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,30}$/.test(id)
}

// Both files list their plugin imports in one contiguous block, so a new
// import goes after the last existing one. Anchoring on the block (rather
// than a line number) keeps this working as the list grows.
function addImport(source: string, line: string, importRe: RegExp): string {
  if (source.includes(line)) return source
  const matches = [...source.matchAll(importRe)]
  const last = matches.at(-1)
  if (!last) throw new Error('No plugin import block found.')
  const end = last.index + last[0].length
  return `${source.slice(0, end)}\n${line}${source.slice(end)}`
}

export function addToClientConfig(source: string, id: string): string {
  if (!isValidPluginId(id)) throw new Error(`Bad plugin id: ${id}`)
  const ident = identifierFor(id)
  const withImport = addImport(
    source,
    `import ${ident} from '@/plugins/${id}/manifest'`,
    /^import .+ from '@\/plugins\/.+\/manifest'$/gm
  )

  const arrayRe = /(export const PLUGINS[^=]*=\s*\[)([^\]]*)\]/
  const m = arrayRe.exec(withImport)
  if (!m) throw new Error('PLUGINS array not found.')
  const existing = m[2].trim()
  // Idempotent: re-installing must not add a duplicate entry.
  if (new RegExp(`\\b${ident}\\b`).test(existing)) return withImport
  const next = existing ? `${existing.replace(/,\s*$/, '')}, ${ident}` : ident
  return withImport.replace(arrayRe, `$1${next}]`)
}

export function addToServerConfig(source: string, id: string): string {
  if (!isValidPluginId(id)) throw new Error(`Bad plugin id: ${id}`)
  const ident = `${identifierFor(id)}Server`
  const withImport = addImport(
    source,
    `import ${ident} from '@/plugins/${id}/server'`,
    /^import .+ from '@\/plugins\/.+\/server'$/gm
  )

  const objRe = /(export const PLUGIN_SERVERS[^=]*=\s*\{)([^}]*)\}/
  const m = objRe.exec(withImport)
  if (!m) throw new Error('PLUGIN_SERVERS object not found.')
  const body = m[2]
  if (new RegExp(`^\\s*'?${id}'?\\s*:`, 'm').test(body)) return withImport
  const entries = body.trim().replace(/,\s*$/, '')
  const next = entries
    ? `\n  ${entries},\n  ${id}: ${ident}\n`
    : `\n  ${id}: ${ident}\n`
  return withImport.replace(objRe, `$1${next}}`)
}
