'use client'

import { RelationKind } from './status'
import { useDashTheme } from './theme'

interface RelationIconProps {
  kind: RelationKind
  className?: string
}

export default function RelationIcon({
  kind,
  className = 'size-4'
}: RelationIconProps) {
  const { mode } = useDashTheme()
  const ink = mode === 'light' ? '#18181b' : '#e4e4e7'
  const innerLight = '#ffffff'

  switch (kind) {
    case 'triage':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-orange-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <path
            d="M3.6 8 L12.4 8 M5.3 6.3 L3.6 8 L5.3 9.7 M10.7 6.3 L12.4 8 L10.7 9.7"
            fill="none"
            stroke={innerLight}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'blocked_by':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-rose-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <rect
            x="4.4"
            y="7.2"
            width="7.2"
            height="1.6"
            rx="0.6"
            fill={innerLight}
          />
        </svg>
      )

    case 'blocks':
      return (
        <svg viewBox="0 0 16 16" className={`${className} text-orange-500`}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <rect
            x="7.25"
            y="3.8"
            width="1.5"
            height="5.2"
            rx="0.4"
            fill={innerLight}
          />
          <rect
            x="7.25"
            y="10.1"
            width="1.5"
            height="1.6"
            rx="0.4"
            fill={innerLight}
          />
        </svg>
      )

    case 'parent':
      return (
        <svg viewBox="0 0 16 16" className={className} style={{ color: ink }}>
          <path
            d="M4.2 11.8 L11.8 4.2 M6 4.2 L11.8 4.2 L11.8 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    case 'sub_issue':
      return (
        <svg viewBox="0 0 16 16" className={className} style={{ color: ink }}>
          <rect
            x="2.5"
            y="5.5"
            width="8.5"
            height="8.5"
            rx="1.6"
            fill="currentColor"
          />
          <rect
            x="5"
            y="2.5"
            width="8.5"
            height="8.5"
            rx="1.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      )
  }
}
