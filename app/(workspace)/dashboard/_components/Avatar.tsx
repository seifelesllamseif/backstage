'use client'

import Image from 'next/image'
import { BoardAssignee } from './boardData'
import { getPresence } from './presence'

interface AvatarProps {
  user: BoardAssignee
  size?: number
  className?: string
  // Render a colored ring + opacity treatment based on the user's
  // computed presence. Off by default so cramped surfaces (avatar
  // stacks, mention chips) stay tight.
  showPresence?: boolean
}

const TEXT_SIZE: Record<number, string> = {
  16: 'text-[8px]',
  20: 'text-[9px]',
  24: 'text-[10px]',
  28: 'text-[11px]',
  32: 'text-xs',
  40: 'text-sm',
  56: 'text-base',
  72: 'text-lg'
}

// Tailwind ring color for each derived presence state. The container
// already carries `ring-2`, so each value just supplies the hue.
const RING_CLASS: Record<ReturnType<typeof getPresence>, string> = {
  online: 'ring-emerald-500',
  today: 'ring-amber-400/60',
  away: 'ring-zinc-300 dark:ring-zinc-600',
  on_vacation: 'ring-zinc-400/40',
  left: 'ring-zinc-500/30'
}

const DIM_CLASS: Partial<
  Record<ReturnType<typeof getPresence>, string>
> = {
  on_vacation: 'opacity-50 grayscale',
  left: 'opacity-30 grayscale'
}

export default function Avatar({
  user,
  size = 20,
  className = '',
  showPresence = false
}: AvatarProps) {
  const textClass = TEXT_SIZE[size] ?? 'text-[10px]'
  const presence = showPresence ? getPresence(user) : null
  const presenceRing = presence
    ? `ring-1 ring-offset-1 ring-offset-transparent ${RING_CLASS[presence]}`
    : ''
  const presenceDim = presence ? DIM_CLASS[presence] ?? '' : ''

  if (user.photo) {
    return (
      <span
        className={`relative inline-flex rounded-full overflow-hidden shrink-0 align-middle ${presenceRing} ${presenceDim} ${className}`}
        style={{ width: size, height: size }}
        title={user.name}
      >
        <Image
          src={user.photo}
          alt={user.name}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </span>
    )
  }

  return (
    <span
      title={user.name}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 align-middle ${user.color} ${textClass} ${presenceRing} ${presenceDim} ${className}`}
      style={{ width: size, height: size }}
    >
      {user.initials}
    </span>
  )
}
