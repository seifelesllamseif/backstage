'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Undo2 } from 'lucide-react'
import { listTrashedTasks, restoreDashboardTask } from '../actions'
import { Button } from '@/components/ui/button'

interface TrashPanelProps {
  accessTier: 'admin' | 'lead' | 'member'
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function TrashPanel({ accessTier }: TrashPanelProps) {
  const queryClient = useQueryClient()
  const canRestore = accessTier === 'admin' || accessTier === 'lead'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['trashedTasks'],
    queryFn: async () => {
      const result = await listTrashedTasks()
      if ('error' in result) throw new Error(result.error)
      return result.rows
    },
    enabled: canRestore,
    refetchOnWindowFocus: false
  })

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRestore(taskId: string) {
    setPendingId(taskId)
    startTransition(async () => {
      const result = await restoreDashboardTask(taskId)
      setPendingId(null)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Task restored')
      queryClient.invalidateQueries({ queryKey: ['trashedTasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardInitial'] })
      void refetch()
    })
  }

  if (!canRestore) {
    return (
      <div className="p-8 text-sm text-zinc-500">
        Trash is visible to admins and leads only.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-rose-500" />
        <h1 className="text-lg font-semibold">Trash</h1>
        <span className="ml-2 text-sm text-zinc-500">
          {data ? `${data.length} task${data.length === 1 ? '' : 's'}` : null}
        </span>
      </div>
      <p className="text-sm text-zinc-500">
        Deleted tasks live here. Admins and leads can restore them to put the
        task back in its project with its history intact.
      </p>

      {isLoading && <div className="text-sm text-zinc-500">Loading trash…</div>}
      {isError && (
        <div className="text-sm text-rose-600">
          Could not load trash:{' '}
          {error instanceof Error ? error.message : 'unknown error'}
        </div>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          Trash is empty.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="w-28 px-3 py-2 font-medium">Ref</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="w-40 px-3 py-2 font-medium">Project</th>
                <th className="w-44 px-3 py-2 font-medium">Deleted by</th>
                <th className="w-44 px-3 py-2 font-medium">Deleted at</th>
                <th className="w-32 px-3 py-2 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                    {row.ref ?? '—'}
                  </td>
                  <td className="max-w-md truncate px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2 text-sm text-zinc-700">
                    {row.project?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-700">
                    {row.deletedBy?.fullName ?? 'Unknown'}
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-500">
                    {formatTimestamp(row.deletedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending && pendingId === row.id}
                      onClick={() => handleRestore(row.id)}
                    >
                      <Undo2 className="h-4 w-4" />
                      {isPending && pendingId === row.id
                        ? 'Restoring…'
                        : 'Restore'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
