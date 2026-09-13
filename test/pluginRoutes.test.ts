import { describe, expect, it } from 'vitest'
import { notFound, resolveRoute } from '@/lib/plugins/routes'
import type { PluginRoutes } from '@/lib/plugins/types'

const ok = () => new Response('ok')
const routes: PluginRoutes = {
  '': { POST: ok },
  'oauth/consent': { GET: ok }
}

describe('resolveRoute', () => {
  it('maps the empty subpath to the mount root', () => {
    expect(resolveRoute(routes, [], 'POST')).toBe(ok)
  })

  it('joins nested segments with a slash', () => {
    expect(resolveRoute(routes, ['oauth', 'consent'], 'GET')).toBe(ok)
  })

  it('does not fall back across methods', () => {
    // A GET on a POST-only endpoint must miss, not silently invoke the
    // POST handler — MCP mounts POST at the root and a stray GET there
    // would otherwise run a tool call.
    expect(resolveRoute(routes, [], 'GET')).toBeUndefined()
  })

  it('misses on unknown subpaths and on plugins with no routes', () => {
    expect(resolveRoute(routes, ['nope'], 'POST')).toBeUndefined()
    expect(resolveRoute(undefined, [], 'POST')).toBeUndefined()
  })

  it('does not resolve inherited Object properties as routes', () => {
    // routes is an object literal, so 'constructor'/'toString' are
    // reachable via the prototype; returning one would hand the caller a
    // non-handler and crash the dispatcher.
    expect(resolveRoute(routes, ['constructor'], 'GET')).toBeUndefined()
    expect(resolveRoute(routes, ['toString'], 'GET')).toBeUndefined()
  })
})

describe('notFound', () => {
  it('is a bare 404 that leaks no install inventory', async () => {
    const res = notFound()
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })
})

describe('resolveRoute wildcards', () => {
  const wild: PluginRoutes = {
    'w/*': { POST: ok },
    'w/fixed': { POST: () => new Response('fixed') }
  }

  it("matches a dynamic segment via 'w/*'", () => {
    expect(resolveRoute(wild, ['w', 'company-123'], 'POST')).toBe(ok)
  })

  it('prefers a concrete key over the wildcard', () => {
    // Ordering matters: if the wildcard won, a plugin could never carve
    // out a special case under its own dynamic prefix.
    expect(resolveRoute(wild, ['w', 'fixed'], 'POST')).not.toBe(ok)
  })

  it('still honours the method on a wildcard match', () => {
    expect(resolveRoute(wild, ['w', 'company-123'], 'GET')).toBeUndefined()
  })

  it('does not let a wildcard swallow a shorter path', () => {
    expect(resolveRoute(wild, ['w'], 'POST')).toBeUndefined()
  })
})

describe('resolveRoute: bare key alongside a deeper wildcard', () => {
  // The shape plugins/mcp/server.ts registers for RFC 9728 discovery: the
  // bare well-known path explains itself, while each workspace's real
  // document sits under the wildcard. Neither may shadow the other.
  const root = () => new Response('root')
  const scoped = () => new Response('scoped')
  const wellKnown: PluginRoutes = {
    'oauth-protected-resource': { GET: root },
    'oauth-protected-resource/api/p/mcp/w/*': { GET: scoped }
  }

  it('serves the bare path from the exact key', () => {
    expect(resolveRoute(wellKnown, ['oauth-protected-resource'], 'GET')).toBe(
      root
    )
  })

  it('serves a workspace document from the wildcard', () => {
    const path = 'oauth-protected-resource/api/p/mcp/w/abc'.split('/')
    expect(resolveRoute(wellKnown, path, 'GET')).toBe(scoped)
  })

  it('does not let the bare key swallow the deeper path', () => {
    const path = 'oauth-protected-resource/api/p/mcp/w/abc'.split('/')
    expect(resolveRoute(wellKnown, path, 'GET')).not.toBe(root)
  })
})
