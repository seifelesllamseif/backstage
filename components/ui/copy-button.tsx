'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

// Shape of a single entry in the dropdown. Each entry produces a string via
// `getContent()` and announces what was copied via `toastLabel`.
//
// A `submenu` lets us nest options (e.g. "By cycle > Phase 1, Phase 2").
// The submenu is rendered inline as an accordion, not as a flyout, to
// avoid building a portal positioning layer just for this.
export interface CopyMenuItem {
  id: string
  label: string
  description?: string
  getContent?: () => string
  toastLabel?: string
  submenu?: CopyMenuItem[]
  separatorBefore?: boolean
}

interface CopyButtonProps {
  // Primary action: clicking the main button (not the chevron) runs this.
  primaryLabel: string
  primaryGetContent: () => string
  primaryToastLabel?: string
  menu?: CopyMenuItem[]
  size?: 'sm' | 'md'
  className?: string
  // Compact mode: hides the primary label, shows just the icon. Useful in
  // dense surfaces like a project card.
  iconOnly?: boolean
  // Show the label only at very wide widths (2xl+). Below that, the
  // button collapses to icon + chevron. Use in the dashboard Topbar
  // where horizontal space is contested.
  responsiveLabel?: boolean
}

async function copyToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content)
      return true
    }
    // Fallback for non-secure contexts (rare in dev/prod but possible).
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

async function runCopy(content: string, label: string) {
  const ok = await copyToClipboard(content)
  if (ok) toast.success(`Copied ${label}`)
  else toast.error('Copy failed. Your browser may have blocked clipboard access.')
}

export function CopyButton({
  primaryLabel,
  primaryGetContent,
  primaryToastLabel,
  menu = [],
  size = 'sm',
  className,
  iconOnly = false,
  responsiveLabel = false,
}: CopyButtonProps) {
  const [open, setOpen] = useState(false)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const [justCopied, setJustCopied] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setOpenSubmenuId(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setOpenSubmenuId(null)
      }
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handlePrimary = async () => {
    const content = primaryGetContent()
    await runCopy(content, primaryToastLabel ?? primaryLabel.toLowerCase())
    setJustCopied(true)
    setTimeout(() => setJustCopied(false), 1500)
  }

  const handleMenuItem = async (item: CopyMenuItem) => {
    if (item.submenu && item.submenu.length > 0) {
      setOpenSubmenuId((cur) => (cur === item.id ? null : item.id))
      return
    }
    if (!item.getContent) return
    const content = item.getContent()
    await runCopy(content, item.toastLabel ?? item.label.toLowerCase())
    setOpen(false)
    setOpenSubmenuId(null)
    setJustCopied(true)
    setTimeout(() => setJustCopied(false), 1500)
  }

  const heightClass = size === 'sm' ? 'h-7' : 'h-8'

  return (
    <div ref={wrapperRef} className={cn('relative inline-flex', className)}>
      <div className="flex rounded-md bg-secondary text-secondary-foreground shadow-none">
        <button
          type="button"
          onClick={handlePrimary}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-l-md px-2.5 text-[11px] font-medium transition hover:bg-secondary/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            heightClass,
            iconOnly && 'px-2 rounded-md',
            !iconOnly && menu.length === 0 && 'rounded-md'
          )}
          aria-label={iconOnly || responsiveLabel ? primaryLabel : undefined}
          title={iconOnly || responsiveLabel ? primaryLabel : undefined}
        >
          {justCopied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {!iconOnly && (
            <span className={responsiveLabel ? 'hidden 2xl:inline' : undefined}>
              {primaryLabel}
            </span>
          )}
        </button>
        {menu.length > 0 && !iconOnly && (
          <>
            <span className="self-center bg-foreground/10 w-px h-4" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'flex shrink-0 items-center justify-center rounded-r-md px-1.5 transition hover:bg-secondary/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                heightClass
              )}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="More copy options"
            >
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </button>
          </>
        )}
      </div>

      {open && menu.length > 0 && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 min-w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          <ul className="flex flex-col py-1">
            {menu.map((item) => (
              <CopyMenuRow
                key={item.id}
                item={item}
                isSubmenuOpen={openSubmenuId === item.id}
                onSelect={handleMenuItem}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CopyMenuRow({
  item,
  isSubmenuOpen,
  onSelect,
}: {
  item: CopyMenuItem
  isSubmenuOpen: boolean
  onSelect: (item: CopyMenuItem) => void
}) {
  const hasSubmenu = !!item.submenu && item.submenu.length > 0
  return (
    <li>
      {item.separatorBefore && (
        <div className="my-1 h-px bg-border" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition hover:bg-accent hover:text-accent-foreground"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate">{item.label}</span>
          {item.description && (
            <span className="text-[10px] text-muted-foreground">
              {item.description}
            </span>
          )}
        </span>
        {hasSubmenu && (
          <ChevronDown
            className={cn(
              'size-3 shrink-0 transition-transform',
              isSubmenuOpen && 'rotate-180'
            )}
          />
        )}
      </button>
      {hasSubmenu && isSubmenuOpen && (
        <ul className="flex flex-col bg-muted/30">
          {item.submenu!.map((sub) => (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => onSelect(sub)}
                className="flex w-full items-center gap-2 px-6 py-1.5 text-left text-xs transition hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">{sub.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
