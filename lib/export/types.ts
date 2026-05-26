// Lightweight, client-side serializers that turn dashboard data into either
// markdown (for human + LLM ingestion) or JSON (for agent memory).
//
// The JSON shape is versioned (v1) so an agent that consumed a paste
// yesterday can know whether to expect new fields today. Bump `version`
// in the writers if you change the shape in a breaking way.

import type {
  BoardAssignee,
  BoardTask,
  Cycle,
  ProjectExternalRef,
  TaskExternalRef,
} from '@/app/(workspace)/dashboard/_components/boardData'
import type { TaskComment, TaskActivity } from '@/app/(workspace)/dashboard/_components/TaskDetail'

export type ExportFormat = 'md' | 'json'

export interface ProjectLite {
  id: string
  name: string
  kind: 'standard' | 'operations'
  isArchived: boolean
  githubRepo: string | null
}

export interface ExportContext {
  tasks: BoardTask[]
  cycles: Cycle[]
  projects: ProjectLite[]
  members: BoardAssignee[]
  commentsByTask: Record<string, TaskComment[]>
  activityByTask: Record<string, TaskActivity[]>
  refsByTask: Record<string, TaskExternalRef[]>
  refsByProject: Record<string, ProjectExternalRef[]>
}

export interface ExportOptions {
  // Drop comments + activity from the export. Default false (we include
  // everything by default for max agent context).
  withoutCommentsAndActivity?: boolean
}

export const EXPORT_VERSION = 'v1' as const
