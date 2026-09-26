import { describe, expect, it } from 'vitest'
import { dropTargetStatus } from '@/app/(workspace)/dashboard/_components/boardData'

const tasks = [
  { id: 'a', status: 'todo' as const },
  { id: 'b', status: 'in_progress' as const }
]

describe('dropTargetStatus', () => {
  it('reads the status out of a column drop target', () => {
    expect(dropTargetStatus('col:in_progress', tasks)).toBe('in_progress')
  })

  it('takes the status of the card dropped onto', () => {
    expect(dropTargetStatus('b', tasks)).toBe('in_progress')
  })

  // The regression: columns of a non-status grouping share the col: prefix.
  // Returning 'high' here is what silently wrote a bad enum and left the
  // status unchanged.
  it('refuses a column target that is not a status', () => {
    expect(dropTargetStatus('col:high', tasks)).toBeNull()
    expect(dropTargetStatus('col:unassigned', tasks)).toBeNull()
  })

  it('is null for an unknown target', () => {
    expect(dropTargetStatus('gone', tasks)).toBeNull()
  })
})
