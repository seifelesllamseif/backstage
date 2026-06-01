'use client'

import { createContext, ReactNode, useContext } from 'react'
import { TaskPriority, TaskStatus } from './status'

export interface TaskActions {
  changeStatus: (id: string, s: TaskStatus) => void
  changePriority: (id: string, p: TaskPriority) => void
  changeAssignee: (id: string, assigneeId: string | null) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  copyRef: (ref: string) => void
  // Copy a shareable /dashboard/task/<ref> URL to clipboard. Used by the
  // card context menu + the task drawer share button.
  copyShareLink: (ref: string) => void
  openDetail: (id: string) => void
  addInColumn: (status?: TaskStatus) => void
  // Filter shortcuts wired up from card context menus. Toggle membership
  // in the current multi-select array. Pass null to clear that axis.
  toggleStatusFilter: (s: TaskStatus) => void
  clearStatusFilter: () => void
  toggleAssigneeFilter: (id: string) => void
  clearAssigneeFilter: () => void
  // Members can't hard-delete tasks; they can only flip status to
  // canceled/duplicate. Admins + leads keep the delete actions.
  canDeleteTasks: boolean
}

const TaskActionsContext = createContext<TaskActions | null>(null)

export function TaskActionsProvider({
  children,
  value
}: {
  children: ReactNode
  value: TaskActions
}) {
  return (
    <TaskActionsContext.Provider value={value}>
      {children}
    </TaskActionsContext.Provider>
  )
}

export function useTaskActions() {
  const ctx = useContext(TaskActionsContext)
  if (!ctx) throw new Error('useTaskActions outside provider')
  return ctx
}
