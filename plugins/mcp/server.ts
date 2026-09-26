import 'server-only'

import {
  createMcpHandler,
  getPublicOrigin,
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
import {
  parseCompanyId,
  parseCompanyIdFromResourceMetadataPath,
  verifyMcpToken
} from './auth'
import { registerTools } from './tools'
import { MCP_VERSION } from './version'

// MCP endpoint, mounted per workspace at /api/p/mcp/w/<companyId>.
// Stateless Streamable HTTP: POST only. GET/DELETE are for resumable SSE
// sessions we don't run — add them with the first tool that streams.

// `instructions` is the one piece of text an MCP client puts in front of the
// model before it picks a tool - per-tool descriptions are only read once a
// tool is already being considered. Everything here is a rule that a model
// otherwise gets wrong: inventing ids, filing bare titles, editing without
// reading, or treating a write as a draft.
const INSTRUCTIONS = `Backstage is the team's task tracker: projects hold tasks, tasks carry status, assignee, priority, due date, checklist, comments and links, and sprints group tasks into time boxes.

You are connected as one real member. Every write is immediately visible to the whole team, is attributed to that member, and sends them notifications - there is no draft mode and no undo for most of it. Act like you are typing into their account, because you are.

Start of a session:
- Call whoami to see who you are acting as and your access tier.
- Call get_workspace for project, sprint and label ids, and list_team for member ids. Ids are UUIDs: read them from these tools, never guess one, never pass a name where an id is asked for.

Before you write:
- search_tasks first. Filing a duplicate is worse than asking.
- get_task before editing an existing one - it returns the description, checklist, comments and links that the search result omits.

When you write:
- Fill every field the request implies: assigneeId, priority, dueDate. A title-only task makes a human chase the detail you already had. Do not invent a field that was not stated.
- Use create_tasks_bulk for more than one task, not a loop of create_task.
- update_task takes only the fields that change.
- A URL worth keeping goes on the task or project with manage_links, not just in your reply.
- Tasks have a human ref like WEB-12. Use it when you talk to the user; pass ids to tools.

Access: every member can read the workspace and manage their own work. Creating or archiving projects, creating and running sprints, deleting tasks and managing project members need lead or admin. If a tool says you lack the tier, say so - do not retry.`

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: 'Backstage', version: MCP_VERSION },
  instructions: INSTRUCTIONS
})

// Token verification. Returning undefined makes withMcpAuth answer 401 with
// the WWW-Authenticate header that points clients at the metadata below —
// that header is what starts the OAuth flow, so failures here must stay 401
// rather than 404.
async function verify(request: Request, token?: string) {
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
}

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
  const authed = withMcpAuth(mcp, verify, {
    required: true,
    // Every workspace is its own RFC 9728 protected resource, so the 401
    // challenge has to point at that workspace's own discovery document —
    // a single shared /.well-known/oauth-protected-resource can only ever
    // describe one resource, and would mislabel every workspace's token as
    // scoped to the bare origin instead of its own endpoint below.
    resourceMetadataPath: `/.well-known/oauth-protected-resource/api/p/mcp/w/${companyId}`
  })
  return authed(request)
}

// RFC 9728 Protected Resource Metadata, one document per workspace. Public
// by design (no secrets): MCP clients fetch it to discover that this
// project's Supabase OAuth server guards the endpoint, and to learn the
// endpoint's own canonical URL (`resource`) so they can bind the token they
// get back to it rather than to the whole origin.
function resourceMetadata(request: Request): Response {
  const companyId = parseCompanyIdFromResourceMetadataPath(request.url)
  if (!companyId) return notFound()
  return protectedResourceHandler({
    authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
    resourceUrl: `${getPublicOrigin(request)}/api/p/mcp/w/${companyId}`
  })(request)
}

// RFC 9728 puts a resource's metadata at the well-known path with the
// resource's own path appended, so the bare path describes a resource
// mounted at the origin. Nothing is mounted there: every MCP server here
// lives at /api/p/mcp/w/<companyId> and publishes its own document above.
//
// Deliberately still a 404 rather than a document describing the origin —
// that document is what broke audience binding before, because clients
// bound their token to the origin and then called a workspace URL the
// token did not cover. The body just names the real pattern so a stale
// client or a human mid-handshake isn't left guessing. It leaks nothing:
// you need the companyId already for the URL to be any use.
function resourceMetadataRoot(): Response {
  return Response.json(
    {
      error: 'not_found',
      error_description:
        'No protected resource is mounted at the origin. Each workspace ' +
        'publishes its own metadata at /.well-known/oauth-protected-' +
        'resource/api/p/mcp/w/<companyId>. The 401 from an MCP endpoint ' +
        'names the exact URL in its WWW-Authenticate resource_metadata ' +
        'parameter.'
    },
    { status: 404 }
  )
}

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

// MCP Streamable HTTP reserves GET for resumable SSE sessions, which this
// stateless server does not run — the spec's answer for that is 405, not the
// dispatcher's default 404. It also stops a human who pastes the connect URL
// into a browser from concluding the endpoint is broken.
function methodNotAllowed(): Response {
  return new Response(
    'This is an MCP endpoint, not a web page. Add this URL to an MCP client ' +
      '(Claude, Cursor) and it will connect over POST.\n',
    { status: 405, headers: { allow: 'POST' } }
  )
}

const mcpServer: PluginServerModule = {
  actions: { connectInfo },
  routes: {
    'w/*': {
      POST: handleMcp,
      GET: methodNotAllowed,
      DELETE: methodNotAllowed
    }
  },
  wellKnown: {
    'oauth-protected-resource': { GET: resourceMetadataRoot },
    'oauth-protected-resource/api/p/mcp/w/*': {
      GET: resourceMetadata,
      OPTIONS: metadataCorsOptionsRequestHandler()
    }
  }
}

export default mcpServer
