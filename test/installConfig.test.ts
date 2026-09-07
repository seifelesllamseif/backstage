import { describe, expect, it } from 'vitest'
import {
  addToClientConfig,
  addToServerConfig,
  identifierFor
} from '@/lib/install/config'

const CLIENT = `import type { PluginManifest } from '@/lib/plugins/types'
import polls from '@/plugins/polls/manifest'

export const PLUGINS: readonly PluginManifest[] = [polls]
`

const SERVER = `import 'server-only'

import type { PluginServerModule } from '@/lib/plugins/types'
import pollsServer from '@/plugins/polls/server'

export const PLUGIN_SERVERS: Record<string, PluginServerModule> = {
  polls: pollsServer
}
`

describe('identifierFor', () => {
  it('turns a kebab id into a valid import identifier', () => {
    expect(identifierFor('mcp')).toBe('mcp')
    expect(identifierFor('my-plugin')).toBe('myPlugin')
    expect(identifierFor('a-b-c')).toBe('aBC')
  })
})

describe('addToClientConfig', () => {
  it('adds the import and the array entry', () => {
    const out = addToClientConfig(CLIENT, 'mcp')
    expect(out).toContain("import mcp from '@/plugins/mcp/manifest'")
    expect(out).toContain('= [polls, mcp]')
  })

  it('is idempotent', () => {
    // Install, redeploy, install again — a duplicate entry would break the
    // build, which is the worst possible time to find out.
    const once = addToClientConfig(CLIENT, 'mcp')
    expect(addToClientConfig(once, 'mcp')).toBe(once)
  })

  it('rejects an id that is not a safe identifier or path segment', () => {
    expect(() => addToClientConfig(CLIENT, '../evil')).toThrow()
    expect(() => addToClientConfig(CLIENT, 'Bad')).toThrow()
  })

  it('throws instead of emitting a file that will not compile', () => {
    expect(() => addToClientConfig('export const NOPE = 1', 'mcp')).toThrow()
  })
})

describe('addToServerConfig', () => {
  it('adds the import and the map entry', () => {
    const out = addToServerConfig(SERVER, 'mcp')
    expect(out).toContain("import mcpServer from '@/plugins/mcp/server'")
    expect(out).toMatch(/polls: pollsServer,\n\s+mcp: mcpServer/)
  })

  it('is idempotent', () => {
    const once = addToServerConfig(SERVER, 'mcp')
    expect(addToServerConfig(once, 'mcp')).toBe(once)
  })

  it('throws when the anchor is missing', () => {
    expect(() => addToServerConfig("import 'server-only'", 'mcp')).toThrow()
  })
})

describe('parsePluginSource', () => {
  it('parses a registry tree URL', async () => {
    const { parsePluginSource } = await import('@/lib/install/github')
    expect(
      parsePluginSource(
        'https://github.com/acme/backstage/tree/main/plugins/mcp'
      )
    ).toEqual({
      owner: 'acme',
      repo: 'backstage',
      ref: 'main',
      path: 'plugins/mcp'
    })
  })

  it('rejects anything that is not a GitHub tree URL', async () => {
    const { parsePluginSource } = await import('@/lib/install/github')
    // A registry is remote input. Refusing non-tree URLs is what stops an
    // entry from pointing the installer at something it should not read.
    for (const u of [
      'https://github.com/acme/backstage',
      'https://evil.test/acme/backstage/tree/main/plugins/mcp',
      'not a url'
    ]) {
      expect(parsePluginSource(u)).toBeNull()
    }
  })
})
