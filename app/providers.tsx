'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Suspense boundary lets Next 16 (cacheComponents: true) ship the
  // static shell without waiting for the client-side theme + tooltip
  // providers to mount. Without it, prerender bails on /login etc.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={250}>
        <Suspense>{children}</Suspense>
      </TooltipProvider>
      <ThemedToaster />
    </ThemeProvider>
  )
}
