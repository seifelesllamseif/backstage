import 'server-only'

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { getCurrentTeamMember } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'

// Tools deliberately add no new data access. Each one resolves the caller
// through getCurrentTeamMember(), which the route boundary has already
// pinned to a verified (user, workspace) pair — so every existing tier check
// and company_id filter applies unchanged, and an agent can never exceed
// what its member can do in the UI.

async function requireMember() {
  const member = await getCurrentTeamMember()
  // Unreachable via the route (the boundary checks membership first), but a
  // tool must never run unscoped if that ever changes.
  if (!member) throw new Error('Not a member of this workspace.')
  return member
}

// MCP returns text content; JSON is what models parse most reliably.
function json(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  }
}

export function registerTools(server: McpServer) {
  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'The member this connection acts as, including which workspace and what access tier. Call this first to confirm the right workspace.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true }
    },
    async () => {
      const m = await requireMember()
      return json({
        memberId: m.id,
        fullName: m.fullName,
        email: m.email,
        accessTier: m.accessTier,
        workspaceId: m.companyId,
        activityStatus: m.activityStatus
      })
    }
  )

  server.registerTool(
    'get_workspace',
    {
      title: 'Get workspace',
      description:
        'Name and enabled features of the workspace this connection is scoped to.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true }
    },
    async () => {
      const m = await requireMember()
      const { data } = await createAdminClient()
        .from('companies')
        .select('id, name, enabled_features')
        .eq('id', m.companyId)
        .maybeSingle()
      if (!data) throw new Error('Workspace not found.')
      return json({
        id: data.id,
        name: data.name,
        enabledFeatures: data.enabled_features ?? []
      })
    }
  )
}
