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
      visibleToasts={6}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      // Sit below modals/sheets (shadcn sheet defaults to z-50) so an
      // opened task detail covers the stack instead of fighting with
      // the comment composer over the same screen real estate.
      style={{ zIndex: 45 } as React.CSSProperties}
      toastOptions={{
        classNames: {
          // Wraps the toast title so very long task titles don't overflow
          // or get cut off. Soft cap at 3 lines.
          title:
            'text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere] line-clamp-3',
          description:
            'text-[11px] leading-snug break-words [overflow-wrap:anywhere] line-clamp-3'
        }
      }}
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
