export type TaskStatus =
  | 'backlog'
  | 'unscoped'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'canceled'
  | 'duplicate'

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export type RelationKind = 'blocked_by' | 'blocks' | 'parent' | 'sub_issue' | 'triage'

export interface StatusConfig {
  id: TaskStatus
  label: string
}

export const STATUSES: StatusConfig[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'unscoped', label: 'Unscoped' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
  { id: 'canceled', label: 'Canceled' },
  { id: 'duplicate', label: 'Duplicate' }
]

export const RELATION_LABEL: Record<RelationKind, string> = {
  triage: 'Triage',
  blocked_by: 'Blocked by',
  blocks: 'Blocks',
  parent: 'Parent',
  sub_issue: 'Sub-Issue'
}

export const STATUS_BY_ID: Record<TaskStatus, StatusConfig> = STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<TaskStatus, StatusConfig>
)

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority'
}
