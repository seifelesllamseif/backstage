'use client'

import { createContext, ReactNode, useContext, useMemo } from 'react'
import type { BoardAssignee } from './boardData'

// Two questions get asked of the roster, and they want different answers:
//
//   "who can I pick?"      -> useTeam()      - people still here
//   "who is this id?"      -> useDirectory() - everyone, ever
//
// Departed members (activity_status = 'left') have to stay in the payload:
// they still own old tasks, they are still @mentioned in old comments, they
// are still watchers. But they must never appear in something you choose
// from - an assignee menu, a mention list, a filter chip - because picking
// them assigns work to someone who is gone.
//
// useTeam() is the filtered one ON PURPOSE. Every picker in the app reaches
// for the obvious name, so the obvious name is the safe one; forgetting to
// filter now produces nothing worse than a correct list. Reach for
// useDirectory() only when you are resolving an id you were already given.

const TeamContext = createContext<BoardAssignee[] | null>(null)

export function TeamProvider({
  members,
  children
}: {
  members: BoardAssignee[]
  children: ReactNode
}) {
  return <TeamContext.Provider value={members}>{children}</TeamContext.Provider>
}

export function activeMembers(members: BoardAssignee[]): BoardAssignee[] {
  return members.filter((m) => m.activityStatus !== 'left')
}

/** People who are still here. Use for anything a user picks from. */
export function useTeam(): BoardAssignee[] {
  const all = useDirectory()
  return useMemo(() => activeMembers(all), [all])
}

/**
 * Everyone the workspace has ever had, including departed members. Use only
 * to resolve an id you already hold - an old comment's mention, a watcher,
 * the owner of an archived task.
 */
export function useDirectory(): BoardAssignee[] {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam outside <TeamProvider>')
  return ctx
}
