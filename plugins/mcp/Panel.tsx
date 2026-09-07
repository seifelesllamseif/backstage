'use client'

import { useQuery } from '@tanstack/react-query'
import { Plug } from 'lucide-react'

import { CopyButton } from '@/components/ui/copy-button'
import { invokePluginAction } from '@/app/(workspace)/dashboard/plugin-actions'

type ConnectInfo = { url: string }

async function call<T>(action: string, payload?: unknown): Promise<T> {
  const result = await invokePluginAction('mcp', action, payload)
  if ('error' in result) throw new Error(result.error)
  return result.data as T
}

export default function McpPanel() {
  const { data, isPending, error } = useQuery({
    queryKey: ['plugin:mcp'],
    queryFn: () => call<ConnectInfo>('connectInfo')
  })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          <Plug className="size-4" />
          Connect an AI assistant
        </h1>
        <p className="text-muted-foreground text-sm">
          Give this URL to Claude, Cursor, or any MCP client. It signs in as
          you, so your assistant sees exactly what you see — nothing more.
        </p>
      </header>

      {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {data && (
        <>
          <section className="flex flex-col gap-2">
            <label className="text-xs tracking-[0.15em] uppercase opacity-60">
              Your connection URL
            </label>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border px-3 py-2 text-xs">
                {data.url}
              </code>
              <CopyButton
                primaryLabel="Copy URL"
                primaryGetContent={() => data.url}
                iconOnly
              />
            </div>
            <p className="text-muted-foreground text-xs">
              This URL is specific to this workspace. Adding it elsewhere
              connects that assistant to this workspace only.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
