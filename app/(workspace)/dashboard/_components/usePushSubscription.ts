'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  deletePushSubscription,
  fetchPushPublicKey,
  savePushSubscription
} from '../actions'

// Wraps the browser Push API so the Settings toggle can flip notifications
// on / off in one call. Registration is idempotent: each call to enable
// upserts the subscription against its endpoint server-side, so toggling
// off then on won't duplicate rows.

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(safe)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration() {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    return (
      (await navigator.serviceWorker.getRegistration('/')) ??
      (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
    )
  } catch {
    return null
  }
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)
    // Best-effort: ask the SW whether there's already a subscription so
    // the toggle can render the right state on mount.
    void (async () => {
      const reg = await getRegistration()
      if (!reg) return
      const existing = await reg.pushManager.getSubscription()
      setSubscribed(!!existing)
    })()
  }, [])

  const enable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PermissionState)
      if (result !== 'granted') return
      const reg = await getRegistration()
      if (!reg) return
      const keyRes = await fetchPushPublicKey()
      if ('error' in keyRes) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey)
      })
      const json = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }
      await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent
      })
      setSubscribed(true)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const disable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const reg = await getRegistration()
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        setSubscribed(false)
        return
      }
      const endpoint = sub.endpoint
      await sub.unsubscribe().catch(() => undefined)
      await deletePushSubscription(endpoint)
      setSubscribed(false)
    } finally {
      setBusy(false)
    }
  }, [busy])

  return { permission, subscribed, busy, enable, disable }
}
