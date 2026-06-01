'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Avatar from './Avatar'
import { useTeam } from './TeamContext'
import { useDashTheme } from './theme'
import { addComment } from '../actions'
import type { BoardTask } from './boardData'

// Slice C: a small composer for dropping a note that pings a teammate by
// attaching a comment to one of the author's own tasks. Why through a
// task and not as a free-form ping: comments are the only @-mention
// channel today, and routing through the author's task keeps it visible
// in the right project context for both sides. The recipient picks the
// mention up via Mentions in their sidebar; the mention also auto-adds
// them as a spectator on the task (Slice B follow-up).

interface OpenArgs {
  // Member id the note is for. Pre-fills the @-mention.
  memberId: string
}

interface Ctx {
  open: (args: OpenArgs) => void
}

const QuickNoteCtx = createContext<Ctx | null>(null)

export function useQuickNoteSheet(): Ctx {
  const ctx = useContext(QuickNoteCtx)
  if (!ctx) throw new Error('useQuickNoteSheet outside provider')
  return ctx
}

export function QuickNoteSheetProvider({
  tasks,
  currentUserId,
  children
}: {
  // The author's own tasks. We list the ones they're assigned (or lead)
  // on; that's "send them a note on something you own."
  tasks: BoardTask[]
  currentUserId: string
  children: React.ReactNode
}) {
  const team = useTeam()
  const { t } = useDashTheme()
  const [openId, setOpenId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const myTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assignee?.id === currentUserId ||
          task.lead?.id === currentUserId
      ),
    [tasks, currentUserId]
  )

  const target = openId ? team.find((m) => m.id === openId) : null

  const open = useCallback((args: OpenArgs) => {
    setOpenId(args.memberId)
  }, [])

  // Fresh state each time the sheet opens. Pre-fill body with the
  // recipient's name so they recognise themselves immediately and the
  // mention chip renders correctly when committed.
  useEffect(() => {
    if (!target) return
    setBody(`@${target.name} `)
    setTaskId(myTasks[0]?.id ?? null)
  }, [target, myTasks])

  const submit = async () => {
    if (!target || !taskId) return
    if (!body.trim()) return
    setSubmitting(true)
    const res = await addComment(taskId, body.trim(), [target.id])
    setSubmitting(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Note sent.')
    setOpenId(null)
  }

  return (
    <QuickNoteCtx.Provider value={{ open }}>
      {children}
      <Sheet
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) setOpenId(null)
        }}
      >
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className={`w-full p-0 sm:max-w-96! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>
              {target ? `Drop a note for ${target.name}` : 'Drop a note'}
            </SheetTitle>
          </VisuallyHidden.Root>

          <div className="flex h-full flex-col">
            <div
              className={`flex items-center gap-2.5 border-b px-4 py-3 ${t.border}`}
            >
              {target && <Avatar user={target} size={32} showPresence />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-xs leading-tight font-medium ${t.text}`}
                >
                  Drop a note
                </span>
                <span className={`text-[11px] ${t.textMuted}`}>
                  {target?.name ?? ''}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 px-4 py-4">
              {myTasks.length === 0 ? (
                <p className={`text-[11px] italic ${t.textSubtle}`}>
                  You don&apos;t own any tasks to attach a note to yet.
                </p>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span
                      className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                    >
                      Attach to
                    </span>
                    <select
                      value={taskId ?? ''}
                      onChange={(e) => setTaskId(e.target.value)}
                      className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                    >
                      {myTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.ref} - {task.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span
                      className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                    >
                      Message
                    </span>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      className={`resize-none rounded-md border px-2 py-1.5 text-xs leading-relaxed ${t.input}`}
                      placeholder="Quick question or context..."
                    />
                  </label>
                </>
              )}
            </div>

            <div
              className={`mt-auto flex items-center justify-end gap-2 border-t px-4 py-3 ${t.border}`}
            >
              <button
                onClick={() => setOpenId(null)}
                className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !taskId || !body.trim()}
                className={`h-7 rounded-md px-2.5 text-[11px] disabled:opacity-40 ${t.accent}`}
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </QuickNoteCtx.Provider>
  )
}
