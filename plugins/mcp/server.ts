import 'server-only'

import {
  createMcpHandler,
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
  withMcpAuth
} from 'mcp-handler'
import { headers } from 'next/headers'
import { config } from '@/lib/config'
import { getCurrentTeamMember } from '@/lib/dal'
import { isFeatureEnabledForCompany } from '@/lib/features/server'
import { notFound } from '@/lib/plugins/routes'
import {
  pluginFeatureKey,
  type PluginContext,
  type PluginServerModule
} from '@/lib/plugins/types'
import { setRequestIdentity } from '@/lib/requestIdentity'
import { parseCompanyId, verifyMcpToken } from './auth'
import { registerTools } from './tools'

// MCP endpoint, mounted per workspace at /api/p/mcp/w/<companyId>.
// Stateless Streamable HTTP: POST only. GET/DELETE are for resumable SSE
// sessions we don't run — add them with the first tool that streams.

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: 'Backstage', version: '0.1.0' }
})

// Token verification. Returning undefined makes withMcpAuth answer 401 with
// the WWW-Authenticate header that points clients at the metadata below —
// that header is what starts the OAuth flow, so failures here must stay 401
// rather than 404.
const authed = withMcpAuth(
  mcp,
  async (request, token) => {
    if (!token) return undefined
    const companyId = parseCompanyId(request.url)
    if (!companyId) return undefined

    const claims = await verifyMcpToken(token)
    if (!claims) return undefined

    // Pin identity before resolving the member: getCurrentTeamMember() reads
    // this override, and it is the only thing that stops the cookie-less
    // fallback from picking an arbitrary workspace.
    setRequestIdentity({ userId: claims.sub, companyId })

    // Resolves the (user, workspace) membership and fails closed on a
    // removed member whose token has not expired yet.
    const member = await getCurrentTeamMember()
    if (!member) return undefined

    // No scopes: authorisation is by access tier, resolved per request from
    // the member row, so tools inherit the UI's rules rather than a second
    // parallel permission model.
    return { token, clientId: claims.clientId, scopes: [] }
  },
  { required: true }
)

// Pre-auth gates. These run before withMcpAuth so an uninstalled plugin or a
// bad workspace id is a bare 404 — indistinguishable from an unmounted path,
// and never a 401 that would tell an unauthenticated caller the workspace is
// real. See lib/plugins/routes.ts.
async function handleMcp(request: Request): Promise<Response> {
  const companyId = parseCompanyId(request.url)
  if (!companyId) return notFound()
  if (!(await isFeatureEnabledForCompany(companyId, pluginFeatureKey('mcp')))) {
    return notFound()
  }
  return authed(request)
}

// RFC 9728 Protected Resource Metadata. Public by design (no secrets): MCP
// clients fetch it to discover that this project's Supabase OAuth server
// guards the endpoint.
const resourceMetadata = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`]
})

// The panel needs the workspace-scoped URL, and PluginPanelProps carries no
// companyId — so the server supplies it. Origin comes from the request
// rather than config.appUrl so the URL is correct on preview deployments and
// custom domains alike.
async function connectInfo(ctx: PluginContext) {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : config.appUrl
  return { url: `${origin}/api/p/mcp/w/${ctx.companyId}` }
}

const mcpServer: PluginServerModule = {
  actions: { connectInfo },
  routes: { 'w/*': { POST: handleMcp } },
  wellKnown: {
    'oauth-protected-resource': {
      GET: resourceMetadata,
      OPTIONS: metadataCorsOptionsRequestHandler()
    }
  }
}

export default mcpServer
