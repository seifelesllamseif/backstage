// Frontend types for the /dashboard UI. The shapes were originally paired
// with hardcoded demo data here; that data now comes from Prisma — see
// app/(authenticated)/dashboard/actions.ts + mappers.ts. The real values flow
// in through DashboardShell props and TeamContext.

import { RelationKind, STATUSES, TaskPriority, TaskStatus } from './status'

export interface BoardAssignee {
  id: string
  initials: string
  name: string
  color: string
  photo?: string
  role?: string
  // URL-safe handle from team_members.slug. Used to render readable
  // /dashboard URLs (e.g. ?assignee=asim-selim) instead of UUIDs.
  slug?: string | null
  // Presence inputs. lastSeenAt is the most recent workspace-layout
  // touch; activityStatus is the stored manual override (or 'active').
  // Consumers derive a display state via lib/presence.
  lastSeenAt?: string | null
  activityStatus?: 'active' | 'away' | 'on_vacation' | 'left'
  // IANA timezone for the quiet-hours indicator.
  timezone?: string | null
  // When the member joined the workspace. Drives the "Welcome <name>"
  // rotation on the topbar wordmark for anyone joined recently.
  joinedAt?: string | null
}

export interface TaskRelation {
  kind: RelationKind
  ref: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface BoardTask {
  id: string
  ref: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee?: BoardAssignee
  // Lead member: who assignees ask for help. Distinct from assignee.
  lead?: BoardAssignee
  // Member who originally created the task. Drives the "creator can
  // edit tags" gate in TaskDetail.
  createdById?: string
  projectId?: string
  tags?: string[]
  due?: string
  // ISO date string of the actual due date — used to derive the
  // "overdue" / "due-soon" color states without re-parsing `due`.
  dueAt?: string
  createdAt: string
  updatedAt: string
  // Persisted within-column ordering (slice 3b drag/drop). Smaller =
  // higher. Nullable on rows that pre-date the sort_order migration.
  sortOrder?: number
  relations?: TaskRelation[]
  checklist?: ChecklistItem[]
}

export type SprintStatus = 'completed' | 'current' | 'upcoming'

export interface Sprint {
  id: string
  projectId: string
  number: number
  name: string
  goal: string | null
  description: string | null
  docUrl: string | null
  status: SprintStatus
  from: string
  to: string
  fromIso: string
  toIso: string
  startedAtIso: string | null
  closedAtIso: string | null
  shippedCount: number | null
  carriedCount: number | null
  scope: number
  startedCount: number
  startedPct: number
  completedCount: number
  completedPct: number
  percent: number
  taskIds: string[]
  carryCountByTaskId: Record<string, number>
}

export type TaskExternalRefKind =
  | 'issue'
  | 'pr'
  | 'commit'
  | 'doc'
  | 'link'
  | 'supabase'
  | 'github'
  | 'figma'
  | 'verbivore'
  | 'vercel'
  | 'bunny'
  | 'sentry'
  | 'gcloud'
  | 'stripe'

export interface TaskExternalRef {
  id: string
  taskId: string
  kind: TaskExternalRefKind
  url: string
  label: string | null
  createdAt: string
}

export interface ProjectExternalRef {
  id: string
  projectId: string
  kind: TaskExternalRefKind
  url: string
  label: string | null
  createdAt: string
}

// ─── Board drag and drop ────────────────────────────────────────────────
// Column droppable ids are `col:<status>`.
export const COL_PREFIX = 'col:'

// The destination status of a drop, read from the drop target itself.
//
// onDragEnd must not read it back off the status onDragOver wrote into
// React state: dnd-kit fires its final onDragOver in the same batch as
// onDragEnd when the pointer is released just after crossing into a new
// column, so the state the handler closes over still carries the pre-drag
// status. The move then collapses into a same-column reorder and the
// status silently never changes.
//
// Returns null when the target names something that isn't a status — the
// board's non-status groupings (priority, assignee, lead) build column ids
// out of the same `col:` namespace, and writing one of those into
// tasks.status is a Postgres enum error.
export function dropTargetStatus(
  overId: string,
  tasks: Pick<BoardTask, 'id' | 'status'>[]
): TaskStatus | null {
  if (overId.startsWith(COL_PREFIX)) {
    const raw = overId.slice(COL_PREFIX.length)
    return STATUSES.some((s) => s.id === raw) ? (raw as TaskStatus) : null
  }
  return tasks.find((t) => t.id === overId)?.status ?? null
}
