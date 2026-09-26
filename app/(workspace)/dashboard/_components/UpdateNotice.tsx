'use client'

import { useState, useSyncExternalStore } from 'react'
import { ShieldAlert, Sparkles, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UpdateStatus } from '@/lib/updates'

// Admin-only card, bottom-left, over the shell. "available" can be dismissed
// per version (it comes back for the next one); "required" cannot - it means
// this deployment is below release.json's minSupported, i.e. running
// something upstream has declared unsafe.

const DISMISSED_KEY = 'dashboard.update.dismissed'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

export function UpdateNotice({ status }: { status: UpdateStatus }) {
  const dismissedVersion = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(DISMISSED_KEY),
    () => null
  )
  const [dismissedNow, setDismissedNow] = useState(false)
  const required = status.level === 'required'

  if (!required && (dismissedNow || dismissedVersion === status.latest)) {
    return null
  }

  return (
    <div
      role={required ? 'alert' : 'status'}
      className={cn(
        'fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2 rounded-xl border p-3 text-sm shadow-lg',
        required
          ? 'border-red-500/40 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50'
          : 'bg-background'
      )}
    >
      <div className="flex items-start gap-2">
        {required ? (
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        ) : (
          <Sparkles className="mt-0.5 size-4 shrink-0 text-teal-600" />
        )}
        <p className="flex-1 leading-snug">
          <span className="font-medium">
            {required
              ? 'Update required'
              : `Backstage ${status.latest} is available`}
          </span>
          <span className="block opacity-80">
            {status.reason ?? `This deployment is on ${status.current}.`}
          </span>
        </p>
        {!required && (
          <button
            type="button"
            aria-label="Dismiss until the next release"
            className="opacity-60 hover:opacity-100"
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, status.latest)
              setDismissedNow(true)
            }}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <a
        href={status.updateUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          buttonVariants({
            size: 'sm',
            variant: required ? 'default' : 'outline'
          }),
          'self-start'
        )}
      >
        Update to {status.latest}
      </a>
    </div>
  )
}
