'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode
} from 'react'
import { Moon, Sun } from 'lucide-react'
import { flushSync } from 'react-dom'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

export type Mode = 'light' | 'dark'

interface ThemeCtx {
  mode: Mode
  toggle: () => void
  t: (typeof TOKENS)[Mode]
}

const ThemeContext = createContext<ThemeCtx | null>(null)

// Bridges the dashboard's local theme tokens to the app-wide next-themes
// state. Before, the dashboard had an independent mode that ignored the
// global toggle, so switching theme on /portfolio left the dashboard in
// its old mode. Now: `mode` mirrors `resolvedTheme` (so system / light /
// dark all map cleanly) and `toggle()` calls `setTheme()` so the
// existing AnimatedThemeToggler in the topbar moves both contexts in
// lockstep.
export function DashboardThemeProvider({
  children,
  initial = 'light'
}: {
  children: ReactNode
  initial?: Mode
}) {
  const { resolvedTheme, setTheme } = useTheme()
  // First paint before next-themes has hydrated: fall back to `initial`
  // (defaults to light). Once hydrated we sync to whatever the user has
  // chosen globally.
  const [mode, setMode] = useState<Mode>(initial)

  useEffect(() => {
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(resolvedTheme)
    }
  }, [resolvedTheme])

  const toggle = useCallback(() => {
    // Flip via next-themes so /portfolio, /cockpit, etc. follow along.
    const next = mode === 'light' ? 'dark' : 'light'
    setTheme(next)
    setMode(next)
  }, [mode, setTheme])

  return (
    <ThemeContext.Provider value={{ mode, toggle, t: TOKENS[mode] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useDashTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useDashTheme outside provider')
  return ctx
}

export type TransitionVariant =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'rectangle'
  | 'star'

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<'button'> {
  duration?: number
  variant?: TransitionVariant
  fromCenter?: boolean
}

function polygonCollapsed(cx: number, cy: number, vertexCount: number): string {
  const pairs = Array.from(
    { length: vertexCount },
    () => `${cx}px ${cy}px`
  ).join(', ')
  return `polygon(${pairs})`
}

function getThemeTransitionClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  switch (variant) {
    case 'circle':
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`
      ]
    case 'square': {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const halfSide = Math.max(halfW, halfH) * 1.05
      const end = [
        `${cx - halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy + halfSide}px`,
        `${cx - halfSide}px ${cy + halfSide}px`
      ].join(', ')
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case 'triangle': {
      const scale = maxRadius * 2.2
      const dx = (Math.sqrt(3) / 2) * scale
      const verts = [
        `${cx}px ${cy - scale}px`,
        `${cx + dx}px ${cy + 0.5 * scale}px`,
        `${cx - dx}px ${cy + 0.5 * scale}px`
      ].join(', ')
      return [polygonCollapsed(cx, cy, 3), `polygon(${verts})`]
    }
    case 'diamond': {
      const R = maxRadius * Math.SQRT2
      const end = [
        `${cx}px ${cy - R}px`,
        `${cx + R}px ${cy}px`,
        `${cx}px ${cy + R}px`,
        `${cx - R}px ${cy}px`
      ].join(', ')
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case 'hexagon': {
      const R = maxRadius * Math.SQRT2
      const verts: string[] = []
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3
        verts.push(`${cx + R * Math.cos(a)}px ${cy + R * Math.sin(a)}px`)
      }
      return [polygonCollapsed(cx, cy, 6), `polygon(${verts.join(', ')})`]
    }
    case 'rectangle': {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const end = [
        `${cx - halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy + halfH}px`,
        `${cx - halfW}px ${cy + halfH}px`
      ].join(', ')
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case 'star': {
      const R = maxRadius * Math.SQRT2 * 1.03
      const innerRatio = 0.42
      const starPolygon = (radius: number) => {
        const verts: string[] = []
        for (let i = 0; i < 5; i++) {
          const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5
          verts.push(
            `${cx + radius * Math.cos(outerA)}px ${cy + radius * Math.sin(outerA)}px`
          )
          const innerA = outerA + Math.PI / 5
          verts.push(
            `${cx + radius * innerRatio * Math.cos(innerA)}px ${cy + radius * innerRatio * Math.sin(innerA)}px`
          )
        }
        return `polygon(${verts.join(', ')})`
      }
      const startR = Math.max(2, R * 0.025)
      return [starPolygon(startR), starPolygon(R)]
    }
    default:
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`
      ]
  }
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  variant,
  fromCenter = false,
  ...props
}: AnimatedThemeTogglerProps) => {
  const shape = variant ?? 'circle'
  const { mode, toggle } = useDashTheme()
  const isDark = mode === 'dark'
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback(() => {
    const button = buttonRef.current
    if (!button) {
      toggle()
      return
    }

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight

    let x: number
    let y: number
    if (fromCenter) {
      x = viewportWidth / 2
      y = viewportHeight / 2
    } else {
      const { top, left, width, height } = button.getBoundingClientRect()
      x = left + width / 2
      y = top + height / 2
    }

    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    )

    if (typeof document.startViewTransition !== 'function') {
      toggle()
      return
    }

    const clipPath = getThemeTransitionClipPaths(
      shape,
      x,
      y,
      maxRadius,
      viewportWidth,
      viewportHeight
    )

    const root = document.documentElement
    root.dataset.magicuiThemeVt = 'active'
    root.style.setProperty(
      '--magicui-theme-toggle-vt-duration',
      `${duration}ms`
    )
    root.style.setProperty('--magicui-theme-vt-clip-from', clipPath[0])
    const cleanup = () => {
      delete root.dataset.magicuiThemeVt
      root.style.removeProperty('--magicui-theme-toggle-vt-duration')
      root.style.removeProperty('--magicui-theme-vt-clip-from')
    }

    const transition = document.startViewTransition(() => {
      flushSync(toggle)
    })
    if (typeof transition?.finished?.finally === 'function') {
      transition.finished.finally(cleanup)
    } else {
      cleanup()
    }

    const ready = transition?.ready
    if (ready && typeof ready.then === 'function') {
      ready.then(() => {
        document.documentElement.animate(
          { clipPath },
          {
            duration,
            easing: shape === 'star' ? 'linear' : 'ease-in-out',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)'
          }
        )
      })
    }
  }, [shape, fromCenter, duration, toggle])

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={handleClick}
      className={cn(className)}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      {...props}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

export const TOKENS = {
  light: {
    page: 'bg-white text-zinc-900',
    topbar: 'bg-white border-zinc-200',
    sidebar: 'bg-zinc-50/80 border-zinc-200',
    surface: 'bg-white',
    surfaceMuted: 'bg-zinc-50',
    column: 'bg-zinc-50/70 border-zinc-200',
    columnHeader: 'border-zinc-200',
    card: 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300',
    cardText: 'text-zinc-900',
    border: 'border-zinc-200',
    borderSoft: 'border-zinc-100',
    text: 'text-zinc-900',
    textMuted: 'text-zinc-500',
    textSubtle: 'text-zinc-400',
    textFaint: 'text-zinc-300',
    chip: 'border-zinc-200 text-zinc-500 bg-white',
    chipActive: 'bg-teal-900 text-white',
    btn: 'border-zinc-200 text-zinc-700 hover:bg-zinc-100',
    btnActive: 'bg-zinc-100 text-zinc-900',
    accent: 'bg-teal-500 text-white hover:bg-teal-600',
    input: 'bg-white border-zinc-200 placeholder:text-zinc-400 text-zinc-900',
    detail: 'bg-white border-zinc-200',
    backLink: 'text-zinc-500 hover:text-zinc-900',
    tab: 'text-zinc-500 hover:text-zinc-900',
    tabActive: 'bg-zinc-100 text-zinc-900',
    pillStatus: {
      backlog: 'text-yellow-700 border-yellow-200 bg-yellow-100',
      unscoped: 'text-violet-700 border-violet-200 bg-violet-100',
      todo: 'text-zinc-600 border-zinc-200 bg-zinc-100',
      in_progress: 'text-amber-700 border-amber-200 bg-amber-100',
      in_review: 'text-sky-700 border-sky-200 bg-sky-100',
      done: 'text-emerald-700 border-emerald-200 bg-emerald-100',
      canceled: 'text-rose-700 border-rose-200 bg-rose-100',
      duplicate: 'text-zinc-700 border-zinc-200 bg-zinc-100'
    },
    metaTag: 'border-zinc-200 text-zinc-500',
    rowHover: 'hover:bg-zinc-50',
    dividerSoft: 'border-zinc-100',
    accentText: 'text-red-600'
  },
  dark: {
    page: 'bg-black text-white',
    topbar: 'bg-black border-white/10',
    sidebar: 'bg-black border-white/10',
    surface: 'bg-black',
    surfaceMuted: 'bg-white/[0.04]',
    column: 'bg-black/40 border-white/10',
    columnHeader: 'border-white/10',
    card: 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20',
    cardText: 'text-white/90',
    border: 'border-white/10',
    borderSoft: 'border-white/10',
    text: 'text-white',
    textMuted: 'text-white/60',
    textSubtle: 'text-white/40',
    textFaint: 'text-white/30',
    chip: 'border-white/10 text-white/60 bg-transparent',
    chipActive: 'bg-white/10 text-white',
    btn: 'border-white/10 text-white/70 hover:bg-white/5 hover:text-white',
    btnActive: 'bg-white/10 text-white',
    accent: 'bg-teal-500 text-white hover:bg-teal-500/90',
    input:
      'bg-white/[0.04] border-white/10 placeholder:text-white/30 text-white',
    detail: 'bg-black/95 border-white/10',
    backLink: 'text-white/50 hover:text-white',
    tab: 'text-white/60 hover:text-white',
    tabActive: 'bg-white/10 text-white',
    pillStatus: {
      backlog: 'text-yellow-200 border-yellow-200/40 bg-yellow-200/5',
      unscoped: 'text-violet-300 border-violet-400/40 bg-violet-400/10',
      todo: 'text-white/80 border-white/30 bg-white/5',
      in_progress: 'text-amber-300 border-amber-400/40 bg-amber-400/10',
      in_review: 'text-sky-300 border-sky-400/40 bg-sky-400/10',
      done: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10',
      canceled: 'text-rose-300 border-rose-400/40 bg-rose-400/10',
      duplicate: 'text-zinc-200 border-white/20 bg-white/5'
    },
    metaTag: 'border-white/10 text-white/50',
    rowHover: 'hover:bg-white/5',
    dividerSoft: 'border-white/5',
    accentText: 'text-red-400'
  }
} as const
