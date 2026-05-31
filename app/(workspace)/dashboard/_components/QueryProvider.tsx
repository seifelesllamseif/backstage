'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState so the client is stable across rerenders of this component but a
  // fresh one is created per browser tab (avoids cross-request bleed in dev).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Subsequent tab navigation hits cache instantly. After 30s the
            // next access triggers a background refetch (stale-while-revalidate).
            staleTime: 30_000,
            // No automatic refetch on window focus - too noisy for a
            // dashboard you keep open. Manual invalidation via
            // router.refresh or queryClient.invalidateQueries when needed.
            refetchOnWindowFocus: false,
            // One retry on network blip is enough; more than that just
            // delays the error toast.
            retry: 1
          }
        }
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
