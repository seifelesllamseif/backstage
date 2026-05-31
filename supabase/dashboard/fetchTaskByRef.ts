import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
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

// Single-task lookup by ref (e.g. "LMSV-15"). Scoped to the caller's
// company. Returns null when not found / not visible. Used by the
// /dashboard/task/[ref] share page + its opengraph-image route.
export async function fetchTaskByRef(
  ref: string
): Promise<SharedTaskView | null> {
  const member = await getCurrentTeamMember()
  if (!member) return null

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
    .eq('company_id', member.companyId)
    .maybeSingle()

  if (error || !data) return null

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
