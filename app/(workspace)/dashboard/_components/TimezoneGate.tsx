'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, MapPin, Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { updateMyTimezone } from '../actions'
import { useDashTheme } from './theme'

function detectBrowserTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || null
  } catch {
    return null
  }
}

function allTimezones(): string[] {
  try {
    return (
      Intl as unknown as {
        supportedValuesOf: (k: string) => string[]
      }
    ).supportedValuesOf('timeZone')
  } catch {
    return []
  }
}

function formatLocalTime(zone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(now)
  } catch {
    return ''
  }
}

function formatOffset(zone: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset'
    }).formatToParts(now)
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    // "GMT+2" → "UTC+2" reads cleaner to non-Brits.
    return raw.replace(/^GMT/, 'UTC') || 'UTC'
  } catch {
    return ''
  }
}

// "Europe/Istanbul" → { city: "Istanbul", region: "Europe" }
// "America/Argentina/Buenos_Aires" → { city: "Buenos Aires", region: "America · Argentina" }
function splitZone(zone: string): { city: string; region: string } {
  const parts = zone.split('/')
  if (parts.length === 1) return { city: parts[0], region: '' }
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  const region = parts.slice(0, -1).join(' · ')
  return { city, region }
}

interface Props {
  savedTimezone: string | null
  onSaved: (tz: string) => void
}

const SESSION_DISMISS_KEY = 'backstage:tzMismatchDismissed'

export default function TimezoneGate({ savedTimezone, onSaved }: Props) {
  const [browserTz, setBrowserTz] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setBrowserTz(detectBrowserTimezone())
    setMounted(true)
  }, [])

  // Mandatory: missing timezone blocks the dashboard.
  const mustChoose = mounted && !savedTimezone

  // Soft prompt: saved exists but disagrees with the browser. We pop a
  // toast once per session unless dismissed already.
  useEffect(() => {
    if (!mounted) return
    if (!savedTimezone || !browserTz) return
    if (savedTimezone === browserTz) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') return
    const toastId = toast(
      `Your browser says ${browserTz} but your saved timezone is ${savedTimezone}.`,
      {
        description: 'Pick the one that matches where you are now.',
        duration: 30_000,
        action: {
          label: `Use ${browserTz}`,
          onClick: async () => {
            const res = await updateMyTimezone(browserTz)
            if ('error' in res) {
              toast.error(res.error)
              return
            }
            onSaved(res.timezone)
            toast.success('Timezone updated.')
          }
        },
        cancel: {
          label: 'Keep saved',
          onClick: () => {
            sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
          }
        },
        onDismiss: () => {
          sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
        }
      }
    )
    return () => {
      toast.dismiss(toastId)
    }
  }, [mounted, savedTimezone, browserTz, onSaved])

  if (!mustChoose) return null

  return (
    <MandatoryTimezoneDialog
      browserTz={browserTz}
      onSaved={onSaved}
    />
  )
}

function MandatoryTimezoneDialog({
  browserTz,
  onSaved
}: {
  browserTz: string | null
  onSaved: (tz: string) => void
}) {
  const { t } = useDashTheme()
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Tick the clock once a minute so the local-time previews stay current
  // for users who leave the dialog open a while.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const zones = useMemo(() => allTimezones(), [])

  // Only show alternatives when the user explicitly searches. By default
  // we trust the location-detected zone and keep the dialog clean.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return zones
      .filter((z) => {
        const s = z.toLowerCase()
        const friendly = s.replace(/[_/]/g, ' ')
        return s.includes(q) || friendly.includes(q)
      })
      .slice(0, 40)
  }, [zones, query])

  async function saveWith(tz: string) {
    if (!tz || saving) return
    setSaving(true)
    const res = await updateMyTimezone(tz)
    setSaving(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    onSaved(res.timezone)
    toast.success(`Timezone set to ${res.timezone}.`)
  }

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="max-w-[92vw] gap-6 p-6 sm:max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader className="gap-2">
          <AlertDialogTitle className="text-base">
            Pick your timezone
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">
            Shown in your local hours across meetings, due dates and the
            quick room. Match where you actually work.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {browserTz && (
          <button
            type="button"
            onClick={() => saveWith(browserTz)}
            disabled={saving}
            className={`group flex items-center gap-4 rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-4 text-left transition hover:bg-teal-500/15 disabled:opacity-60 ${t.text}`}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-500/20">
              <MapPin className="size-5 text-teal-600 dark:text-teal-400" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
              >
                Use my location
              </span>
              <span className="truncate text-base font-medium leading-tight">
                {splitZone(browserTz).city}
              </span>
              <span className={`truncate text-xs ${t.textMuted}`}>
                {splitZone(browserTz).region} · {formatLocalTime(browserTz, now)} ·{' '}
                {formatOffset(browserTz, now)}
              </span>
            </div>
            <span className="shrink-0 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-white">
              Use this
            </span>
          </button>
        )}

        <div className="flex flex-col gap-3">
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
          >
            Or pick a different one
          </span>
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 ${t.textSubtle}`}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or region..."
              autoComplete="off"
              className={`h-10 w-full rounded-md border pr-3 pl-9 text-sm ${t.input}`}
            />
          </div>

          {searchResults && (
            <div
              className={`flex max-h-80 flex-col overflow-y-auto rounded-md border ${t.border}`}
            >
              {searchResults.length === 0 ? (
                <span
                  className={`px-4 py-8 text-center text-xs italic ${t.textSubtle}`}
                >
                  No matches.
                </span>
              ) : (
                searchResults.map((z) => {
                  const split = splitZone(z)
                  const isBrowser = z === browserTz
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => saveWith(z)}
                      disabled={saving}
                      className={`flex items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0 disabled:opacity-50 ${t.borderSoft} ${t.tab}`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${t.surfaceMuted} ${t.textSubtle}`}
                      >
                        <Clock className="size-3.5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className={`truncate text-sm ${t.text}`}>
                          {split.city}
                          {isBrowser && (
                            <span className="ml-2 rounded bg-teal-500/15 px-1.5 py-0.5 text-[9px] tracking-wider uppercase text-teal-600 dark:text-teal-400">
                              your location
                            </span>
                          )}
                        </span>
                        {split.region && (
                          <span
                            className={`mt-0.5 truncate text-[11px] ${t.textSubtle}`}
                          >
                            {split.region}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 leading-none">
                        <span className={`text-sm tabular-nums ${t.text}`}>
                          {formatLocalTime(z, now)}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${t.textSubtle}`}
                        >
                          {formatOffset(z, now)}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
