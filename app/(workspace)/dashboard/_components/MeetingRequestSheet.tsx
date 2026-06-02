'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Avatar from './Avatar'
import { useTeam } from './TeamContext'
import { useDashTheme } from './theme'
import { createMeetingRequest } from '../actions'

// Sheet that lets a member submit a meeting request against another
// teammate. Two modes:
//   - 'day':   requester picks one date. Requestee picks the time later.
//   - 'slots': requester proposes 2-3 specific datetimes. Requestee
//              picks one.

const DURATIONS = [15, 30, 45, 60, 90] as const

interface OpenArgs {
  memberId: string
}

interface Ctx {
  open: (args: OpenArgs) => void
}

const MeetingRequestCtx = createContext<Ctx | null>(null)

export function useMeetingRequestSheet(): Ctx {
  const ctx = useContext(MeetingRequestCtx)
  if (!ctx) throw new Error('useMeetingRequestSheet outside provider')
  return ctx
}

function dateOffset(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function datetimeLocalOffset(hours: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30 - (d.getMinutes() % 30))
  d.setSeconds(0)
  d.setMilliseconds(0)
  d.setHours(d.getHours() + hours)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MeetingRequestSheetProvider({
  children
}: {
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  const team = useTeam()
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [durationMin, setDurationMin] = useState<(typeof DURATIONS)[number]>(30)
  const [mode, setMode] = useState<'day' | 'slots'>('day')
  const [proposedDate, setProposedDate] = useState<string>('')
  const [slots, setSlots] = useState<string[]>([])
  const [submitting, startSubmit] = useTransition()

  const target = openId ? team.find((m) => m.id === openId) : null

  const open = useCallback((args: OpenArgs) => {
    setOpenId(args.memberId)
  }, [])

  // Fresh state each time the sheet opens. Default mode = 'day' (the
  // lighter-weight ask). Slot defaults seeded so switching modes shows
  // sensible placeholders.
  useEffect(() => {
    if (!target) return
    setTitle('')
    setAgenda('')
    setDurationMin(30)
    setMode('day')
    setProposedDate(dateOffset(1))
    setSlots([datetimeLocalOffset(24), datetimeLocalOffset(48)])
  }, [target])

  const today = useMemo(() => dateOffset(0), [])

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (mode === 'day') {
      if (!proposedDate) return false
      if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) return false
      if (proposedDate < today) return false
      return true
    }
    if (slots.length < 2) return false
    return slots.every((s) => s && !Number.isNaN(new Date(s).getTime()))
  }, [title, mode, proposedDate, slots, today])

  function addSlot() {
    if (slots.length >= 3) return
    setSlots([...slots, datetimeLocalOffset(24 * (slots.length + 1))])
  }

  function removeSlot(i: number) {
    if (slots.length <= 2) return
    setSlots(slots.filter((_, idx) => idx !== i))
  }

  function updateSlot(i: number, value: string) {
    setSlots(slots.map((s, idx) => (idx === i ? value : s)))
  }

  function submit() {
    if (!target) return
    if (!canSubmit) return
    startSubmit(async () => {
      const payload =
        mode === 'day'
          ? {
              mode: 'day' as const,
              requesteeId: target.id,
              title: title.trim(),
              agenda: agenda.trim() || null,
              durationMin,
              proposedDate
            }
          : {
              mode: 'slots' as const,
              requesteeId: target.id,
              title: title.trim(),
              agenda: agenda.trim() || null,
              durationMin,
              slots: slots.map((s) => new Date(s).toISOString())
            }
      const res = await createMeetingRequest(payload)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Meeting request sent for approval.')
      queryClient.invalidateQueries({ queryKey: ['meetingRequests'] })
      setOpenId(null)
    })
  }

  return (
    <MeetingRequestCtx.Provider value={{ open }}>
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
          className={`w-full p-0 sm:max-w-112! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>
              {target ? `Request meeting with ${target.name}` : 'Request meeting'}
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
                  Request meeting
                </span>
                <span className={`text-[11px] ${t.textMuted}`}>
                  with {target?.name ?? ''}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                  placeholder="What's this about?"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Agenda (optional)
                </span>
                <textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className={`resize-none rounded-md border px-2 py-1.5 text-xs leading-relaxed ${t.input}`}
                  placeholder="Context, questions you want to cover..."
                />
              </label>

              <label className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  Duration
                </span>
                <select
                  value={durationMin}
                  onChange={(e) =>
                    setDurationMin(
                      Number(e.target.value) as (typeof DURATIONS)[number]
                    )
                  }
                  className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1">
                <span
                  className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                >
                  When
                </span>
                <div
                  className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
                >
                  <button
                    type="button"
                    onClick={() => setMode('day')}
                    className={`flex-1 rounded px-2.5 py-1 text-xs transition ${mode === 'day' ? t.tabActive : t.tab}`}
                  >
                    Pick a day
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('slots')}
                    className={`flex-1 rounded px-2.5 py-1 text-xs transition ${mode === 'slots' ? t.tabActive : t.tab}`}
                  >
                    Propose 2-3 times
                  </button>
                </div>
              </div>

              {mode === 'day' ? (
                <label className="flex flex-col gap-1">
                  <span
                    className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                  >
                    Day
                  </span>
                  <input
                    type="date"
                    value={proposedDate}
                    min={today}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className={`h-8 rounded-md border px-2 text-xs ${t.input}`}
                  />
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    The requestee picks the time on this day.
                  </span>
                </label>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
                    >
                      Proposed slots ({slots.length}/3)
                    </span>
                    <button
                      type="button"
                      onClick={addSlot}
                      disabled={slots.length >= 3}
                      className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition disabled:opacity-40 ${t.border} ${t.btn}`}
                    >
                      <Plus className="size-3" /> Add slot
                    </button>
                  </div>
                  {slots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={slot}
                        onChange={(e) => updateSlot(i, e.target.value)}
                        className={`h-8 flex-1 rounded-md border px-2 text-xs ${t.input}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        disabled={slots.length <= 2}
                        aria-label={`Remove slot ${i + 1}`}
                        className={`flex size-7 items-center justify-center rounded-md border transition disabled:opacity-40 ${t.border} ${t.btn}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    Times are in your local timezone. The requestee picks one.
                  </span>
                </div>
              )}
            </div>

            <div
              className={`flex items-center justify-end gap-2 border-t px-4 py-3 ${t.border}`}
            >
              <button
                onClick={() => setOpenId(null)}
                className={`h-7 rounded-md border px-2 text-[11px] ${t.btn}`}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className={`h-7 rounded-md px-2.5 text-[11px] disabled:opacity-40 ${t.accent}`}
              >
                {submitting ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </MeetingRequestCtx.Provider>
  )
}
