'use client'

import Image from 'next/image'
import { BoardAssignee } from './boardData'

interface AvatarProps {
  user: BoardAssignee
  size?: number
  className?: string
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

export default function Avatar({
  user,
  size = 20,
  className = ''
}: AvatarProps) {
  const textClass = TEXT_SIZE[size] ?? 'text-[10px]'

  if (user.photo) {
    return (
      <span
        className={`relative inline-block rounded-full overflow-hidden shrink-0 ${className}`}
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
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${user.color} ${textClass} ${className}`}
      style={{ width: size, height: size }}
    >
      {user.initials}
    </span>
  )
}
