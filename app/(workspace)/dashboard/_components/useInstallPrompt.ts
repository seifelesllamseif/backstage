'use client'

import { useCallback, useEffect, useState } from 'react'

// Captures the browser's beforeinstallprompt event so we can drive a
// dedicated "Install app" button from Settings instead of relying on the
// omnibox install icon. On iOS Safari the event never fires, so we
// detect that branch and surface a manual instruction instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState =
  // The page is already running as an installed PWA (display-mode standalone).
  | 'installed'
  // beforeinstallprompt fired and we can prompt on demand.
  | 'available'
  // iOS Safari path: no prompt event; show "Share -> Add to Home Screen".
  | 'ios-manual'
  // Anything else - browser hasn't offered install, nothing to do here.
  | 'unavailable'

function detectIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
  // iPadOS reports as Mac; treat any touch-capable webkit as iOS-like.
  const isIpadOS =
    /Macintosh/.test(ua) && typeof document !== 'undefined' &&
    'ontouchend' in document
  return isIOS || isIpadOS
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari sets navigator.standalone on home-screen PWAs.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>('unavailable')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) {
      setState('installed')
      return
    }
    if (detectIOS()) {
      setState('ios-manual')
      return
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setState('available')
    }
    const onInstalled = () => {
      setDeferred(null)
      setState('installed')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const prompt = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setState('installed')
      setDeferred(null)
    }
  }, [deferred])

  return { state, prompt }
}
