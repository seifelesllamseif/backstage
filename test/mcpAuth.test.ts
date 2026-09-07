import { describe, expect, it } from 'vitest'
import { parseCompanyId, validateOauthClaims } from '@/plugins/mcp/auth'

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('validateOauthClaims', () => {
  it('accepts a token minted by the OAuth flow', () => {
    expect(validateOauthClaims({ sub: 'u1', client_id: 'c1' })).toEqual({
      sub: 'u1',
      clientId: 'c1'
    })
  })

  it('rejects a browser session JWT', () => {
    // The whole point of the client_id gate: a session token is signed by
    // the same project and would otherwise verify, handing MCP access to
    // anyone with a stolen cookie.
    expect(validateOauthClaims({ sub: 'u1' })).toBeNull()
    expect(validateOauthClaims({ sub: 'u1', client_id: '' })).toBeNull()
  })

  it('rejects a missing or malformed sub', () => {
    expect(validateOauthClaims({ client_id: 'c1' })).toBeNull()
    expect(validateOauthClaims({ sub: '', client_id: 'c1' })).toBeNull()
    expect(validateOauthClaims({ sub: 42, client_id: 'c1' })).toBeNull()
  })

  it('rejects non-objects rather than throwing', () => {
    for (const v of [null, undefined, 'nope', 7]) {
      expect(validateOauthClaims(v)).toBeNull()
    }
  })
})

describe('parseCompanyId', () => {
  it('extracts the workspace id from the mount path', () => {
    expect(parseCompanyId(`https://x.test/api/p/mcp/w/${UUID}`)).toBe(UUID)
    expect(parseCompanyId(`https://x.test/api/p/mcp/w/${UUID}/`)).toBe(UUID)
  })

  it('ignores query strings', () => {
    expect(parseCompanyId(`https://x.test/api/p/mcp/w/${UUID}?a=1`)).toBe(UUID)
  })

  it('returns null rather than guessing a workspace', () => {
    // Never fall back to a default: silently picking a workspace is the
    // exact failure this path segment exists to prevent.
    expect(parseCompanyId('https://x.test/api/p/mcp')).toBeNull()
    expect(parseCompanyId('https://x.test/api/p/mcp/w/')).toBeNull()
    expect(parseCompanyId('https://x.test/api/p/mcp/w')).toBeNull()
  })

  it('rejects a non-uuid so path input never reaches the query', () => {
    expect(parseCompanyId('https://x.test/api/p/mcp/w/not-a-uuid')).toBeNull()
    expect(parseCompanyId("https://x.test/api/p/mcp/w/' or 1=1--")).toBeNull()
  })

  it('rejects a deeper path that merely starts with the mount', () => {
    expect(
      parseCompanyId(`https://x.test/api/p/mcp/w/${UUID}/extra`)
    ).toBeNull()
  })

  it('returns null on an unparseable url', () => {
    expect(parseCompanyId('not a url')).toBeNull()
  })
})
