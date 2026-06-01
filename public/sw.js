// Verbivore service worker. Goals:
//   1. Make the app installable (handled by the manifest + a registered SW).
//   2. Survive offline / flaky network with a useful fallback.
//   3. Never serve stale auth-bearing HTML — auth state must come from
//      the network so a signed-out user doesn't see a stale page.
//
// Strategy:
//   - Navigation (HTML): network-first, fall back to cached shell.
//   - Static assets (/_next/static/*, /pwa-*, /logos/*, fonts):
//     stale-while-revalidate.
//   - Everything else (API, Supabase, server actions): network only.

const SHELL_CACHE = 'verbivore-shell-v3'
const ASSET_CACHE = 'verbivore-assets-v3'

// Pre-cache the minimum needed to render an offline shell. Keep this tiny;
// every entry here is a forced download on install.
const SHELL_URLS = [
  '/offline',
  '/logos/favicon.svg',
  '/logos/pwa-192x192.png',
  '/logos/pwa-512x512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/logos/') ||
    /\.(?:woff2?|ttf|otf|eot)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigation: network-first, fall back to offline shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          return fresh
        } catch {
          const cache = await caches.open(SHELL_CACHE)
          const cached = await cache.match('/offline')
          return (
            cached ??
            new Response('Offline', {
              status: 503,
              headers: { 'content-type': 'text/plain' }
            })
          )
        }
      })()
    )
    return
  }

  if (!isStaticAsset(url)) return

  // Static assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE)
      const cached = await cache.match(req)
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined)
          return res
        })
        .catch(() => null)
      return cached ?? (await networkPromise) ?? Response.error()
    })()
  )
})

// ── Push notifications ──────────────────────────────────────────────────
// Payload shape (from lib/push.ts -> PushPayload):
//   { title, body, url, tag? }
// `tag` collapses repeat pushes about the same task into one OS tray
// entry. The icon falls back to the PWA logo we already pre-cache.

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Verbivore', body: event.data.text() }
  }
  const title = payload.title || 'Verbivore'
  const options = {
    body: payload.body || '',
    icon: '/logos/pwa-192x192.png',
    badge: '/logos/pwa-64x64.png',
    tag: payload.tag,
    data: { url: payload.url || '/dashboard' },
    renotify: !!payload.tag
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      // Prefer an already-open dashboard tab: focus + navigate it so we
      // don't pile up new windows.
      for (const client of allClients) {
        try {
          const u = new URL(client.url)
          if (u.origin === self.location.origin) {
            await client.focus()
            if ('navigate' in client) {
              try {
                await client.navigate(url)
              } catch {}
            }
            return
          }
        } catch {}
      }
      await self.clients.openWindow(url)
    })()
  )
})
