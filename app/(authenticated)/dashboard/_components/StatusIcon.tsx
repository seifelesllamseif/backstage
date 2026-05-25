'use client'

import { TaskStatus } from './status'
import { useDashTheme } from './theme'

interface StatusIconProps {
  status: TaskStatus
  className?: string
}

export default function StatusIcon({
  status,
  className = 'size-4'
}: StatusIconProps) {
  const { mode } = useDashTheme()

  const todoStroke = mode === 'light' ? 'text-zinc-400' : 'text-zinc-500'
  const backlogColor =
    mode === 'light' ? 'text-yellow-600/80' : 'text-yellow-300/90'
  const unscopedColor =
    mode === 'light' ? 'text-violet-500' : 'text-violet-400'
  const innerLight = mode === 'light' ? '#ffffff' : '#000000'

  switch (status) {
    case 'backlog':
      return (
        <svg
          viewBox="0 0 16 16"
          className={`${className} ${backlogColor}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle
            cx="8"
            cy="8"
            r="6.2"
            strokeDasharray="1.6 1.8"
            strokeLinecap="round"
          />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      )

    case 'unscoped':
      return (
        <svg
          viewBox="0 0 16 16"
          className={`${className} ${unscopedColor}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle
            cx="8"
            cy="8"
            r="6.2"
            strokeDasharray="1.8 1.8"
            strokeLinecap="round"
          />
        </svg>
      )

    case 'todo':
      return (
        <svg
          viewBox="0 0 16 16"
          className={`${className} ${todoStroke}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="8" cy="8" r="6.2" />
        </svg>
      )

    case 'in_progress':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-amber-500`}>
          <circle
            cx="8"
            cy="8"
            r="6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M8 1.8 A6.2 6.2 0 0 1 8 14.2 Z" fill="currentColor" />
        </svg>
      )

    case 'in_review':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-sky-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" opacity="0.9" />
          <circle cx="8" cy="8" r="2.6" fill={innerLight} />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
        </svg>
      )

    case 'done':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-emerald-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <path
            d="M4.8 8.5 L7.1 10.6 L11.3 6.2"
            fill="none"
            stroke={innerLight}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'canceled':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-rose-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <path
            d="M4.4 11.6 L11.6 4.4"
            fill="none"
            stroke={innerLight}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )

    case 'duplicate':
      return (
        <svg
          viewBox="0 0 16 16"
          className={`${className} ${mode === 'light' ? 'text-zinc-700' : 'text-zinc-200'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="8" cy="8" r="6.2" />
          <path
            d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
