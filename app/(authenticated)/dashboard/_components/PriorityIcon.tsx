'use client'

import { TaskPriority } from './status'
import { useDashTheme } from './theme'

interface PriorityIconProps {
  priority: TaskPriority
  className?: string
}

export default function PriorityIcon({
  priority,
  className = 'size-4'
}: PriorityIconProps) {
  const { mode } = useDashTheme()

  const ink = mode === 'light' ? 'text-zinc-900' : 'text-zinc-100'
  const frameStroke = mode === 'light' ? '#18181b' : '#e4e4e7'
  const dimOpacity = mode === 'light' ? 0.18 : 0.22
  const dashColor = mode === 'light' ? 'text-zinc-400' : 'text-zinc-500'
  const triangleInner = '#ffffff'

  if (priority === 'urgent') {
    return (
      <svg viewBox="0 0 16 16" className={`${className} text-red-500`}>
        <path
          d="M7.13 2.05 a1 1 0 0 1 1.74 0 l5.55 9.62 a1 1 0 0 1 -0.87 1.5 H2.45 a1 1 0 0 1 -0.87 -1.5 z"
          fill="currentColor"
        />
        <rect
          x="7.25"
          y="5.6"
          width="1.5"
          height="4.4"
          rx="0.4"
          fill={triangleInner}
        />
        <rect
          x="7.25"
          y="10.9"
          width="1.5"
          height="1.5"
          rx="0.4"
          fill={triangleInner}
        />
      </svg>
    )
  }

  if (priority === 'none') {
    return (
      <svg viewBox="0 0 16 16" className={`${className} ${dashColor}`}>
        <path
          d="M3.2 8 L12.8 8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const bars = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  const heights = [4.4, 7.2, 10]

  return (
    <svg viewBox="0 0 16 16" className={`${className} ${ink}`}>
      <rect
        x="1.1"
        y="3.4"
        width="13.8"
        height="9.2"
        rx="1.8"
        fill="none"
        stroke={frameStroke}
        strokeWidth="1.3"
      />
      {heights.map((h, i) => (
        <rect
          key={i}
          x={3.4 + i * 3.1}
          y={11.6 - h}
          width="2"
          height={h}
          rx="0.5"
          fill="currentColor"
          opacity={i < bars ? 1 : dimOpacity}
        />
      ))}
    </svg>
  )
}
