'use client'

import { useQuery } from '@tanstack/react-query'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Compass, Moon, Sun, UserCog } from 'lucide-react'
import { startDashboardTour } from './DashboardTour'
import { usePushSubscription } from './usePushSubscription'
import { useInstallPrompt } from './useInstallPrompt'
import {
  disconnectGoogle,
  getGoogleConnectionStatus,
  getMyEmailPrefs,
  sendSelfTestPush,
  setQuickMeetUrl,
  updateMyEmailPrefs
} from '../actions'
import { useCompanyLogoUrl } from '@/lib/features/client'
import { clearCompanyLogo, uploadCompanyLogo } from '../features-actions'
import {
  clearInstallToken,
  getInstallStatus,
  setInstallToken
} from '../install-actions'
import { config } from '@/lib/config'
import { useDashTheme } from './theme'

export function SettingsPanel({
  density,
  setDensity,
  wipLimit,
  setWipLimit,
  showHints,
  setShowHints,
  onboardingComplete,
  accessTier,
  initialQuickMeetUrl
}: {
  density: 'compact' | 'cozy'
  setDensity: (d: 'compact' | 'cozy') => void
  wipLimit: number
  setWipLimit: (n: number) => void
  showHints: boolean
  setShowHints: (b: boolean) => void
  // When the member has finished onboarding, the sidebar drops its
  // "Finish your profile" / "Take a tour" block; we surface the same two
  // actions here so they stay accessible without crowding the nav.
  onboardingComplete: boolean
  // Admin-only sections (Google Calendar connect) gate on this.
  accessTier: 'admin' | 'lead' | 'member'
  initialQuickMeetUrl: string | null
}) {
  const { t, mode, toggle } = useDashTheme()
  const router = useRouter()
  const push = usePushSubscription()
  const install = useInstallPrompt()

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <h2 className={`text-lg font-medium ${t.text}`}>Workspace settings</h2>

        <Row label="Install app">
          {install.state === 'installed' ? (
            <span className={`text-[11px] ${t.textMuted}`}>Installed.</span>
          ) : install.state === 'available' ? (
            <button
              onClick={() => install.prompt()}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
            >
              Install Backstage
            </button>
          ) : install.state === 'ios-manual' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              On iOS: tap Share -&gt; Add to Home Screen, then open it from
              there to receive push notifications.
            </span>
          ) : (
            <span className={`text-[11px] ${t.textMuted}`}>
              Use your browser&apos;s install / Add-to-home-screen option.
            </span>
          )}
        </Row>

        <Row label="Notifications">
          {push.permission === 'unsupported' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              This browser doesn&apos;t support web push.
              {install.state !== 'installed'
                ? ' On iOS you need to install Backstage first.'
                : ''}
            </span>
          ) : push.permission === 'denied' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              Blocked at the browser level. Enable in site settings.
            </span>
          ) : (
            <button
              onClick={() => (push.subscribed ? push.disable() : push.enable())}
              aria-pressed={push.subscribed}
              disabled={push.busy}
              className={`relative h-6 w-11 rounded-full border transition disabled:opacity-50 ${
                push.subscribed
                  ? 'border-teal-500 bg-teal-500'
                  : t.surfaceMuted + ' ' + t.border
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                  push.subscribed ? 'translate-x-0' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}
        </Row>

        {push.subscribed && (
          <Row label="Test notification">
            <button
              onClick={async () => {
                const res = await sendSelfTestPush()
                if ('error' in res) {
                  toast.error(res.error)
                  return
                }
                toast.success(
                  `Sent ${res.sent} · pruned ${res.pruned} · failed ${res.failed}`
                )
              }}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
            >
              Send to my devices
            </button>
          </Row>
        )}

        <EmailNotifications />

        {accessTier === 'admin' && <GoogleCalendarConnection />}

        {accessTier === 'admin' && <PluginInstallConnection />}

        {accessTier === 'admin' && (
          <QuickMeetUrlSetting initialUrl={initialQuickMeetUrl} />
        )}

        {accessTier === 'admin' && <FeaturesPointer />}

        {accessTier === 'admin' && <AppearanceSection />}

        {onboardingComplete && (
          <Row label="Profile">
            <button
              onClick={() => {
                window.location.href = '/onboarding'
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${t.border} ${t.tab}`}
            >
              <UserCog className="size-3.5" /> Edit profile
            </button>
          </Row>
        )}

        <Row label="Theme">
          <button
            onClick={toggle}
            aria-label={
              mode === 'light'
                ? 'Switch to dark theme'
                : 'Switch to light theme'
            }
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${t.border} ${t.tab}`}
          >
            {mode === 'light' ? (
              <>
                <Moon className="size-3.5" /> Switch to dark
              </>
            ) : (
              <>
                <Sun className="size-3.5" /> Switch to light
              </>
            )}
          </button>
        </Row>

        <Row label="Card density">
          <ToggleGroup
            value={density}
            onChange={(v) => setDensity(v as 'compact' | 'cozy')}
            options={[
              { id: 'compact', label: 'Compact' },
              { id: 'cozy', label: 'Cozy' }
            ]}
          />
        </Row>

        {/* WIP limit per column - hidden for now.
        <Row label="WIP limit per column">
          <input
            type="number"
            min={0}
            value={wipLimit}
            onChange={(e) => setWipLimit(Math.max(0, Number(e.target.value)))}
            className={`h-9 w-24 rounded-md border px-2 text-xs ${t.input}`}
          />
        </Row>
        */}

        <Row label="Show help hints">
          <button
            onClick={() => setShowHints(!showHints)}
            aria-pressed={showHints}
            className={`relative h-6 w-11 rounded-full border transition ${
              showHints
                ? 'border-teal-500 bg-teal-500'
                : t.surfaceMuted + ' ' + t.border
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                showHints ? 'translate-x-0' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>

        {onboardingComplete && (
          <Row label="Walkthrough">
            <button
              onClick={() => startDashboardTour(router)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${t.border} ${t.tab}`}
            >
              <Compass className="size-3.5" /> Take a tour
            </button>
          </Row>
        )}
      </div>
    </div>
  )
}

function EmailNotifications() {
  const { t } = useDashTheme()
  const [prefs, setPrefs] = useState<{
    mentions: boolean
    assigned: boolean
    meetings: boolean
  } | null>(null)
  const [saving, setSaving] = useState<
    null | 'mentions' | 'assigned' | 'meetings'
  >(null)

  useEffect(() => {
    let alive = true
    getMyEmailPrefs().then((res) => {
      if (!alive) return
      if ('prefs' in res) setPrefs(res.prefs)
    })
    return () => {
      alive = false
    }
  }, [])

  async function toggle(key: 'mentions' | 'assigned' | 'meetings') {
    if (!prefs) return
    const next = !prefs[key]
    setPrefs({ ...prefs, [key]: next })
    setSaving(key)
    const res = await updateMyEmailPrefs({ [key]: next })
    if ('error' in res) {
      toast.error(res.error)
      setPrefs({ ...prefs })
    } else {
      setPrefs(res.prefs)
    }
    setSaving(null)
  }

  const rows: Array<{
    key: 'mentions' | 'assigned' | 'meetings'
    label: string
  }> = [
    { key: 'mentions', label: 'Email on mention' },
    { key: 'assigned', label: 'Email when assigned a task' },
    { key: 'meetings', label: 'Email for meeting requests' }
  ]

  return (
    <>
      {rows.map((row) => {
        const on = prefs?.[row.key] ?? true
        const isSaving = saving === row.key
        return (
          <Row key={row.key} label={row.label}>
            <button
              onClick={() => toggle(row.key)}
              aria-pressed={on}
              disabled={prefs === null || isSaving}
              className={`relative h-6 w-11 rounded-full border transition disabled:opacity-50 ${
                on
                  ? 'border-teal-500 bg-teal-500'
                  : t.surfaceMuted + ' ' + t.border
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                  on ? 'translate-x-0' : 'translate-x-0.5'
                }`}
              />
            </button>
          </Row>
        )
      })}
    </>
  )
}

// Plugins compile at build time, so installing one means committing it to
// this deployment's repo. Vercel already tells us which repo that is; the
// token is the only thing a human supplies, and it lives in app_secrets so
// setting it needs no redeploy.
function PluginInstallConnection() {
  const { t } = useDashTheme()
  const [token, setToken] = useState('')
  const [busy, startBusy] = useTransition()
  const { data: status, refetch } = useQuery({
    queryKey: ['pluginInstallStatus'],
    queryFn: () => getInstallStatus()
  })
  const refresh = () => void refetch()

  if (!status) return null

  if (!status.repo) {
    return (
      <Row label="Plugin installs">
        <span className={`text-xs ${t.textMuted}`}>
          Unavailable — this deployment&apos;s repo could not be determined.
        </span>
      </Row>
    )
  }

  if (status.connected) {
    return (
      <Row label="Plugin installs">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${t.textMuted}`}>
            Installing to {status.repo}
          </span>
          {!status.managedByEnv && (
            <button
              type="button"
              disabled={busy}
              className={`text-xs underline ${t.textMuted}`}
              onClick={() =>
                startBusy(async () => {
                  await clearInstallToken()
                  toast.success('GitHub disconnected.')
                  refresh()
                })
              }
            >
              Disconnect
            </button>
          )}
        </div>
      </Row>
    )
  }

  return (
    <Row label="Plugin installs">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={token}
            placeholder="GitHub token"
            onChange={(e) => setToken(e.target.value)}
            className={`w-44 rounded-md border px-2 py-1 text-xs ${t.border}`}
          />
          <button
            type="button"
            disabled={busy || !token.trim()}
            className={`text-xs underline ${t.textMuted}`}
            onClick={() =>
              startBusy(async () => {
                const res = await setInstallToken(token)
                if ('error' in res) {
                  toast.error(res.error)
                  return
                }
                setToken('')
                toast.success('GitHub connected. One-click install is on.')
                refresh()
              })
            }
          >
            Connect
          </button>
        </div>
        <span className={`text-[11px] ${t.textMuted}`}>
          Fine-grained token, Contents: read and write on {status.repo}.
        </span>
      </div>
    </Row>
  )
}

function GoogleCalendarConnection() {
  const { t } = useDashTheme()
  const [status, setStatus] = useState<null | {
    configured: boolean
    connected: boolean
    connectedAt: string | null
    lastUsedAt: string | null
    googleEmail: string | null
    connectedByName: string | null
  }>(null)
  const [busy, startBusy] = useTransition()

  async function refresh() {
    const res = await getGoogleConnectionStatus()
    if (res && !('error' in res)) {
      setStatus(res)
    }
  }

  useEffect(() => {
    refresh()
    // Pick up the ?google=... callback param. We do this once on mount;
    // the callback route redirects back to /dashboard/settings with one
    // of: connected | admin_only | bad_state | <error message>.
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const flag = sp.get('google')
    if (flag) {
      if (flag === 'connected') {
        toast.success('Google Calendar connected.')
      } else if (flag === 'admin_only') {
        toast.error('Only an admin can connect the workspace calendar.')
      } else if (flag === 'bad_state' || flag === 'state_mismatch') {
        toast.error('Link expired. Try connecting again.')
      } else if (flag !== 'missing_params' && flag !== 'not_signed_in') {
        toast.error(`Google: ${decodeURIComponent(flag)}`)
      }
      sp.delete('google')
      const qs = sp.toString()
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}`
      )
    }
  }, [])

  function disconnect() {
    startBusy(async () => {
      const res = await disconnectGoogle()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Disconnected.')
      refresh()
    })
  }

  if (!status) return null
  if (!status.configured) {
    return (
      <Row label="Google Calendar">
        <span className={`text-[11px] ${t.textMuted}`}>
          Not configured. Server is missing GOOGLE_CLIENT_ID / SECRET.
        </span>
      </Row>
    )
  }
  if (!status.connected) {
    return (
      <Row label="Google Calendar">
        <a
          href="/api/google/oauth/start"
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
        >
          Connect
        </a>
      </Row>
    )
  }
  return (
    <Row label="Google Calendar">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] ${t.textMuted}`}>
          {status.googleEmail
            ? `Connected as ${status.googleEmail}`
            : `Connected by ${status.connectedByName ?? 'someone'}`}
        </span>
        <button
          onClick={disconnect}
          disabled={busy}
          className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.btn}`}
        >
          Disconnect
        </button>
      </div>
    </Row>
  )
}

function QuickMeetUrlSetting({ initialUrl }: { initialUrl: string | null }) {
  const { t } = useDashTheme()
  const [value, setValue] = useState(initialUrl ?? '')
  const [savedValue, setSavedValue] = useState(initialUrl ?? '')
  const [saving, startSaving] = useTransition()

  const dirty = value.trim() !== savedValue.trim()

  function save() {
    startSaving(async () => {
      const res = await setQuickMeetUrl(value)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const next = res.url ?? ''
      setSavedValue(next)
      setValue(next)
      toast.success(next ? 'Quick room URL saved.' : 'Quick room URL cleared.')
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <span className={`text-sm ${t.text}`}>Quick meeting room</span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.btn}`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://meet.google.com/abc-defg-hij"
        className={`h-8 w-full rounded-md border px-2 text-xs ${t.input}`}
      />
      <p className={`text-[10px] leading-relaxed ${t.textSubtle}`}>
        Always-on Google Meet room joinable from the topbar Mon-Fri, 7:00-18:00
        workspace time. Paste a Meet link you keep open in the background or one
        that auto-admits members.
      </p>
    </div>
  )
}

// Feature toggles moved to the Marketplace (one enable/disable surface
// for core modules and plugins alike); Settings keeps a pointer.
function FeaturesPointer() {
  const { t } = useDashTheme()
  const router = useRouter()
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${t.border}`}
    >
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${t.text}`}>Features</span>
        <span className={`text-[11px] ${t.textMuted}`}>
          Modules and plugins are managed in the Marketplace.
        </span>
      </div>
      <button
        onClick={() => router.push('/dashboard/marketplace')}
        className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
      >
        Open Marketplace
      </button>
    </div>
  )
}

function AppearanceSection() {
  const { t } = useDashTheme()
  const router = useRouter()
  const logoUrl = useCompanyLogoUrl()
  const [busy, setBusy] = useState<'upload' | 'clear' | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy('upload')
    const form = new FormData()
    form.append('logo', file)
    const res = await uploadCompanyLogo(form)
    if ('error' in res) toast.error(res.error)
    else {
      toast.success('Logo updated.')
      router.refresh()
    }
    setBusy(null)
  }

  async function onClear() {
    setBusy('clear')
    const res = await clearCompanyLogo()
    if ('error' in res) toast.error(res.error)
    else {
      toast.success('Logo removed.')
      router.refresh()
    }
    setBusy(null)
  }

  return (
    <div className={`flex flex-col gap-3 border-t pt-4 ${t.border}`}>
      <div className="flex flex-col gap-1">
        <h3 className={`text-sm font-medium ${t.text}`}>Appearance</h3>
        <p className={`text-[11px] leading-relaxed ${t.textSubtle}`}>
          Upload a workspace logo (PNG, JPG, WEBP, or SVG, 2 MB max). Shown on
          the sidebar and login screen. Leave blank to fall back to the{' '}
          {config.appName} wordmark.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Workspace logo"
            className="size-12 rounded-lg border object-contain p-1"
            style={{ backgroundColor: 'transparent' }}
          />
        ) : (
          <div
            className={`flex size-12 items-center justify-center rounded-lg border bg-[#948CC0]/15 text-lg font-bold text-[#6E62B0] ${t.border}`}
            aria-hidden
          >
            {config.appName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label
            className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.border} ${t.tab} ${
              busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {busy === 'upload' ? 'Uploading...' : 'Upload logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onFile}
              disabled={busy !== null}
              className="hidden"
            />
          </label>
          {logoUrl && (
            <button
              onClick={onClear}
              disabled={busy !== null}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition disabled:opacity-50 ${t.border} ${t.tab}`}
            >
              {busy === 'clear' ? 'Removing...' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${t.text}`}>{label}</span>
      {children}
    </div>
  )
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded px-2.5 py-1 text-xs transition ${
            value === opt.id ? t.tabActive : t.tab
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
