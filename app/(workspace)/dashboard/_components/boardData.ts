// Frontend types for the /dashboard UI. The shapes were originally paired
// with hardcoded demo data here; that data now comes from Prisma — see
// app/(authenticated)/dashboard/actions.ts + mappers.ts. The real values flow
// in through DashboardShell props and TeamContext.

import { RelationKind, TaskPriority, TaskStatus } from './status'

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
  status: TaskStatus
  priority: TaskPriority
  assignee?: BoardAssignee
  // Lead member: who assignees ask for help. Distinct from assignee.
  lead?: BoardAssignee
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
  description: string | null
  docUrl: string | null
  status: SprintStatus
  from: string
  to: string
  fromIso: string
  toIso: string
  scope: number
  startedCount: number
  startedPct: number
  completedCount: number
  completedPct: number
  percent: number
  taskIds: string[]
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
