import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import type { Database } from '@/supabase/types'

type TaskStatus = Database['public']['Enums']['task_status']
type TaskPriority = Database['public']['Enums']['task_priority']

interface SharedTaskMember {
  id: string
  fullName: string
  avatarUrl: string | null
  slug: string | null
}

export interface SharedTaskView {
  id: string
  ref: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
  project: { id: string; name: string }
  assignee: SharedTaskMember | null
  lead: SharedTaskMember | null
}

// Single-task lookup by ref (e.g. "LMSV-15"). PUBLIC by design: used by
// the shareable /dashboard/task/[ref] view and its opengraph-image route,
// so it resolves for any caller (no session required) including OG
// crawlers. Refs are unique across the single-tenant company (each
// project has its own prefix + seq), so no company filter is needed.
// When Backstage goes multi-tenant, swap this for a tokenized share URL.
// Tasks inserted outside the app (a SQL seed, a restored dump) can land
// with a null `ref`. mappers.ts fills the gap for display with the first
// eight hex digits of the uuid, and the share button copies whatever ref
// the card is showing — so those links arrived here as "D6B41504" and
// matched no row. Resolve that shape against the id instead.
//
// A uuid's first block is its leading text, and Postgres orders uuids
// lexically, so a half-open range on the primary key finds it without a
// cast (PostgREST filters can't cast) and without a scan.
const ID_PREFIX = /^[0-9a-f]{8}$/i

export async function fetchTaskByRef(
  ref: string
): Promise<SharedTaskView | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `
      id, ref, title, description, status, priority,
      due_date, created_at, updated_at,
      project:projects!task_project_id_fkey(id, name),
      assignee:team_members!task_assignee_id_fkey(id, full_name, avatar_url, slug),
      lead:team_members!task_lead_id_fkey(id, full_name, avatar_url, slug)
    `
    )
    .eq('ref', ref)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return null
  if (!data) {
    if (!ID_PREFIX.test(ref)) return null
    const p = ref.toLowerCase()
    const { data: byId } = await supabase
      .from('tasks')
      .select('ref')
      .gte('id', `${p}-0000-0000-0000-000000000000`)
      .lte('id', `${p}-ffff-ffff-ffff-ffffffffffff`)
      .is('deleted_at', null)
      .limit(2)
    // Two hits means the prefix is ambiguous; refuse rather than guess.
    if (!byId || byId.length !== 1) return null
    const resolved = byId[0].ref
    return resolved && resolved !== ref ? fetchTaskByRef(resolved) : null
  }

  const projectRel = data.project as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
  const project = Array.isArray(projectRel) ? projectRel[0] : projectRel
  if (!project) return null

  const toMember = (
    raw:
      | {
          id: string
          full_name: string
          avatar_url: string | null
          slug: string | null
        }
      | {
          id: string
          full_name: string
          avatar_url: string | null
          slug: string | null
        }[]
      | null
  ): SharedTaskMember | null => {
    const m = Array.isArray(raw) ? raw[0] : raw
    if (!m) return null
    return {
      id: m.id,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      slug: m.slug
    }
  }

  return {
    id: data.id,
    ref: data.ref ?? ref,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    dueDate: data.due_date,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    project: { id: project.id, name: project.name },
    assignee: toMember(data.assignee as Parameters<typeof toMember>[0]),
    lead: toMember(data.lead as Parameters<typeof toMember>[0])
  }
}
