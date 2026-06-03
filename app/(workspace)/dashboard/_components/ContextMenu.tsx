'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { useDashTheme } from './theme'

export interface MenuItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  // Renders flush to the right of the item, before any shortcut/chevron.
  // Used for selection check-marks so the row's left icon can keep its
  // role as a category glyph (Rocket, Calendar, etc).
  trailingIcon?: ReactNode
  shortcut?: string
  destructive?: boolean
  disabled?: boolean
  // Native hover tooltip. Useful on disabled items to explain WHY
  // (e.g. "You're already on this view" or "Pick a project first").
  title?: string
  onSelect?: () => void
  submenu?: MenuItem[]
  separator?: boolean
}

interface ContextState {
  items: MenuItem[]
  x: number
  y: number
}

interface ContextMenuCtx {
  open: (e: React.MouseEvent, items: MenuItem[]) => void
  close: () => void
}

const ContextMenuContext = createContext<ContextMenuCtx | null>(null)

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextState | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const open = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ items, x: e.clientX, y: e.clientY })
  }, [])

  const close = useCallback(() => setState(null), [])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onClick = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [state, close])

  return (
    <ContextMenuContext.Provider value={{ open, close }}>
      {children}
      {mounted &&
        state &&
        createPortal(
          <MenuLayer
            items={state.items}
            x={state.x}
            y={state.y}
            onClose={close}
          />,
          document.body
        )}
    </ContextMenuContext.Provider>
  )
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error('useContextMenu outside provider')
  return ctx
}

function MenuLayer({
  items,
  x,
  y,
  onClose
}: {
  items: MenuItem[]
  x: number
  y: number
  onClose: () => void
}) {
  const { t, mode } = useDashTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [adjusted, setAdjusted] = useState({ x, y })

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const next = { x, y }
    if (x + rect.width > window.innerWidth - 8)
      next.x = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight - 8)
      next.y = window.innerHeight - rect.height - 8
    if (next.x !== adjusted.x || next.y !== adjusted.y) setAdjusted(next)
  }, [x, y, adjusted])

  return (
    <div
      className="fixed inset-0 z-[60]"
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <Menu
        ref={ref}
        items={items}
        x={adjusted.x}
        y={adjusted.y}
        onClose={onClose}
        theme={t}
        mode={mode}
      />
    </div>
  )
}

const Menu = ({
  ref,
  items,
  x,
  y,
  onClose,
  theme,
  mode
}: {
  ref?: React.Ref<HTMLDivElement>
  items: MenuItem[]
  x: number
  y: number
  onClose: () => void
  theme: ReturnType<typeof useDashTheme>['t']
  mode: ReturnType<typeof useDashTheme>['mode']
}) => {
  const [submenu, setSubmenu] = useState<{
    items: MenuItem[]
    x: number
    y: number
  } | null>(null)
  const surface =
    mode === 'light'
      ? 'bg-white border-zinc-200'
      : 'bg-zinc-950 border-white/10'

  return (
    <>
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className={`absolute min-w-[200px] rounded-md border shadow-xl py-1 ${surface}`}
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.separator ? (
            <div
              key={`sep-${i}`}
              className={`my-1 border-t ${theme.borderSoft}`}
            />
          ) : (
            <button
              key={item.id}
              disabled={item.disabled}
              title={item.title}
              onMouseEnter={(e) => {
                if (item.submenu) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setSubmenu({
                    items: item.submenu,
                    x: rect.right,
                    y: rect.top
                  })
                } else {
                  setSubmenu(null)
                }
              }}
              onClick={() => {
                if (item.submenu || item.disabled) return
                item.onSelect?.()
                onClose()
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                item.destructive
                  ? 'text-rose-500 hover:bg-rose-500/10'
                  : `${theme.tab} ${theme.rowHover}`
              }`}
            >
              {item.icon && (
                <span className="shrink-0 inline-flex items-center justify-center w-4">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
              {item.trailingIcon && (
                <span className="shrink-0 inline-flex items-center justify-center">
                  {item.trailingIcon}
                </span>
              )}
              {item.shortcut && (
                <span
                  className={`text-[10px] tracking-wider ${theme.textSubtle}`}
                >
                  {item.shortcut}
                </span>
              )}
              {item.submenu && (
                <ChevronRight
                  className={`size-3 ${theme.textSubtle} shrink-0`}
                />
              )}
            </button>
          )
        )}
      </div>
      {submenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute min-w-[180px] rounded-md border shadow-xl py-1 ${surface}`}
          style={{ left: submenu.x + 4, top: submenu.y }}
        >
          {submenu.items.map((sub, i) =>
            sub.separator ? (
              <div
                key={`sub-sep-${i}`}
                className={`my-1 border-t ${theme.borderSoft}`}
              />
            ) : (
              <button
                key={sub.id}
                disabled={sub.disabled}
                onClick={() => {
                  if (sub.disabled) return
                  sub.onSelect?.()
                  onClose()
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition disabled:opacity-40 ${
                  sub.destructive
                    ? 'text-rose-500 hover:bg-rose-500/10'
                    : `${theme.tab} ${theme.rowHover}`
                }`}
              >
                {sub.icon && (
                  <span className="shrink-0 inline-flex items-center justify-center w-4">
                    {sub.icon}
                  </span>
                )}
                <span className="flex-1 truncate">{sub.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </>
  )
}
