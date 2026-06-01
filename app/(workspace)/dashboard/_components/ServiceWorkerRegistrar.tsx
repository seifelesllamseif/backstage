'use client'

import { useEffect } from 'react'

// Registers /sw.js on the first dashboard mount so the offline cache and
// push notification handlers are live for every navigation. Idempotent
// (the browser dedupes registrations against the same scope).

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => undefined)
  }, [])
  return null
}
