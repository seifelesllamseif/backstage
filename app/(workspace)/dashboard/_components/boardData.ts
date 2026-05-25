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

export type CycleStatus = 'completed' | 'current' | 'upcoming'

export interface Cycle {
  id: string
  number: number
  name: string
  status: CycleStatus
  from: string
  to: string
  scope: number
  startedCount: number
  startedPct: number
  completedCount: number
  completedPct: number
  percent: number
  taskIds: string[]
}
