'use client'

import { createContext, ReactNode, useContext } from 'react'
import type { BoardAssignee } from './boardData'

const TeamContext = createContext<BoardAssignee[] | null>(null)

export function TeamProvider({
  members,
  children
}: {
  members: BoardAssignee[]
  children: ReactNode
}) {
  return (
    <TeamContext.Provider value={members}>{children}</TeamContext.Provider>
  )
}

export function useTeam(): BoardAssignee[] {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam outside <TeamProvider>')
  return ctx
}
