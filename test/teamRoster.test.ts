import { describe, expect, it } from 'vitest'
import { activeMembers } from '@/app/(workspace)/dashboard/_components/TeamContext'
import type { BoardAssignee } from '@/app/(workspace)/dashboard/_components/boardData'

const member = (
  id: string,
  activityStatus?: BoardAssignee['activityStatus']
): BoardAssignee => ({
  id,
  initials: id.slice(0, 2).toUpperCase(),
  name: id,
  color: 'bg-zinc-500',
  activityStatus
})

describe('activeMembers', () => {
  it('drops members who left, keeps everyone else', () => {
    const roster = activeMembers([
      member('ada'),
      member('grace', 'away'),
      member('linus', 'on_vacation'),
      member('gone', 'left')
    ])
    expect(roster.map((m) => m.id)).toEqual(['ada', 'grace', 'linus'])
  })

  it('keeps members with no recorded status', () => {
    // activityStatus is optional on BoardAssignee; undefined means active,
    // and a missing field must never be read as "gone".
    expect(activeMembers([member('ada')])).toHaveLength(1)
  })
})
