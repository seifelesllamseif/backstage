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
  openDetail: (id: string) => void
  addInColumn: (status?: TaskStatus) => void
  setStatusFilter: (s: TaskStatus | null) => void
  setAssigneeFilter: (id: string | null) => void
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
