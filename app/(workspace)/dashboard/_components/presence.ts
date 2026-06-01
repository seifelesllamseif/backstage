import type { BoardAssignee } from './boardData'

// Display states derived from (activity_status, last_seen_at). The stored
// activity_status takes priority for the manual overrides (on_vacation,
// left). For 'active' we look at last_seen_at and decide between online,
// today, and away.
export type Presence = 'online' | 'today' | 'away' | 'on_vacation' | 'left'

const ONLINE_WINDOW_MS = 5 * 60 * 1000
const TODAY_WINDOW_MS = 24 * 60 * 60 * 1000
// Same threshold as lib/dal.derivePresence so server and client agree on
// when an "active" member crosses into "away".
const AWAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function getPresence(member: BoardAssignee): Presence {
  if (member.activityStatus === 'left') return 'left'
  if (member.activityStatus === 'on_vacation') return 'on_vacation'
  if (member.activityStatus === 'away') return 'away'
  if (!member.lastSeenAt) return 'away'
  const delta = Date.now() - new Date(member.lastSeenAt).getTime()
  if (delta < ONLINE_WINDOW_MS) return 'online'
  if (delta < TODAY_WINDOW_MS) return 'today'
  if (delta > AWAY_WINDOW_MS) return 'away'
  return 'today'
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: 'Online',
  today: 'Active today',
  away: 'Away',
  on_vacation: 'On vacation',
  left: 'Left the team'
}

// Sort order: more available first. Used by the sidebar team list so the
// most-pingable teammates rise to the top.
const PRESENCE_RANK: Record<Presence, number> = {
  online: 0,
  today: 1,
  away: 2,
  on_vacation: 3,
  left: 4
}

export function presenceRank(member: BoardAssignee): number {
  return PRESENCE_RANK[getPresence(member)]
}
