// Permission helpers for the team management page (ADR 0034). The same
// matrix runs server-side (in supabase/dashboard/team.ts) and client-side
// (to hide / disable actions in the UI). Keep this as a pure module so
// both surfaces can import it cheaply.

export type AccessTier = 'admin' | 'lead' | 'member'

export interface Actor {
  id: string
  accessTier: AccessTier
  isOwner: boolean
}

export interface Target {
  id: string
  accessTier: AccessTier
  isOwner: boolean
}

// Page-level gate. Owners, admins, and leads can open the page; members
// don't see it in the sidebar and the server actions reject them.
export function canSeeTeamPage(actor: Actor): boolean {
  return (
    actor.isOwner ||
    actor.accessTier === 'admin' ||
    actor.accessTier === 'lead'
  )
}

// Invite gate: the actor is asking to invite someone at `targetTier`.
// Owners and admins can invite anyone (including admin). Leads can only
// invite members.
export function canInvite(actor: Actor, targetTier: AccessTier): boolean {
  if (!canSeeTeamPage(actor)) return false
  if (actor.isOwner) return true
  if (actor.accessTier === 'admin') return true
  // lead
  return targetTier === 'member'
}

// Soft-remove (activity_status='left') and reinstate share the same gate
// as edit-profile: it's "can I touch this row at all". We never delete
// the owner. Admins can't delete themselves (would orphan permissions).
function canActOn(actor: Actor, target: Target): boolean {
  if (!canSeeTeamPage(actor)) return false
  if (target.isOwner) return false
  if (actor.isOwner) return true
  if (actor.accessTier === 'admin') {
    if (target.id === actor.id) return false
    return true
  }
  // lead: only members
  return target.accessTier === 'member'
}

export function canSoftRemove(actor: Actor, target: Target): boolean {
  return canActOn(actor, target)
}

export function canReinstate(actor: Actor, target: Target): boolean {
  return canActOn(actor, target)
}

export function canEditProfile(actor: Actor, target: Target): boolean {
  return canActOn(actor, target)
}

// Changing tier has an extra dimension: the destination tier matters.
// Promoting anyone to owner is never allowed (use a dedicated ownership
// transfer flow if/when we add one). Leads can't change tier at all
// because the only sub-tier they manage is 'member' (no-op).
export function canChangeTier(
  actor: Actor,
  target: Target,
  newTier: AccessTier
): boolean {
  if (!canActOn(actor, target)) return false
  if (actor.accessTier === 'lead') return false
  if (target.accessTier === newTier) return false
  return true
}

// Cancel a pending invite: same surface as removing a member at that
// tier (you wouldn't grant access you couldn't otherwise grant).
export function canCancelInvite(
  actor: Actor,
  inviteTier: AccessTier
): boolean {
  return canInvite(actor, inviteTier)
}
