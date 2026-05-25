'use client'

import * as React from 'react'
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
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
      <ThemedToaster />
    </ThemeProvider>
  )
}
