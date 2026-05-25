'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type Mode = 'light' | 'dark'

interface ThemeCtx {
  mode: Mode
  toggle: () => void
  t: typeof TOKENS.light
}

const ThemeContext = createContext<ThemeCtx | null>(null)

export function DashboardThemeProvider({
  children,
  initial = 'light'
}: {
  children: ReactNode
  initial?: Mode
}) {
  const [mode, setMode] = useState<Mode>(initial)
  const toggle = () => setMode((m) => (m === 'light' ? 'dark' : 'light'))
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
    chipActive: 'bg-zinc-900 text-white',
    btn: 'border-zinc-200 text-zinc-700 hover:bg-zinc-100',
    btnActive: 'bg-zinc-100 text-zinc-900',
    accent: 'bg-red-500 text-white hover:bg-red-600',
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
    accent: 'bg-red-500 text-white hover:bg-red-500/90',
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
