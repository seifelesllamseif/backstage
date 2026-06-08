'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, LogIn, LogOut, UserPlus, Video } from 'lucide-react'
import { toast } from 'sonner'

import { createClient as createBrowserSupabase } from '@/supabase/client'
import { useDashTheme } from './theme'
import { isQuickRoomOpen } from '@/lib/quickRoom'
import {
  heartbeatQuickRoom,
  inviteToQuickRoom,
  joinQuickRoom,
  leaveQuickRoom
} from '../actions'
import type { BoardAssignee } from './boardData'
import Avatar from './Avatar'

interface PresenceRow {
  member_id: string
  company_id: string
  joined_at: string
  last_heartbeat: string
}

interface Props {
  companyId: string
  meetUrl: string | null
  me: BoardAssignee
  team: BoardAssignee[]
  // Admins see a "Set up URL" hint when meetUrl is missing.
  isAdmin: boolean
  onOpenSettings: () => void
}

// Browser heartbeats this often. Must stay well under the server's
// PRESENCE_TTL_MS (2 minutes) so a single missed beat doesn't drop us.
const HEARTBEAT_MS = 30_000
// Client-side stale filter cutoff. Matches the server's PRESENCE_TTL_MS
// so we hide rows the next sweep would delete.
const STALE_MS = 2 * 60 * 1000

export default function QuickRoomButton({
  companyId,
  meetUrl,
  me,
  team,
  isAdmin,
  onOpenSettings
}: Props) {
  const { t } = useDashTheme()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PresenceRow[]>([])
  const [inRoom, setInRoom] = useState(false)
  const [window_, setWindow] = useState(() => isQuickRoomOpen())
  const heartbeatIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // Periodic "resweep" to hide rows that crossed the staleness threshold
  // without us getting a DELETE event yet (server sweeps opportunistically
  // on join/heartbeat, but if nobody else is interacting we could lag).
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setWindow(isQuickRoomOpen()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Initial fetch + realtime sub on quick_room_presence for this company.
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let alive = true

    async function refresh() {
      const { data } = await supabase
        .from('quick_room_presence')
        .select('member_id, company_id, joined_at, last_heartbeat')
        .eq('company_id', companyId)
      if (!alive || !data) return
      setRows(data as PresenceRow[])
      const self = data.find((r) => r.member_id === me.id)
      if (self) setInRoom(true)
    }
    refresh()

    const channel = supabase
      .channel(`quick-room-presence:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_room_presence',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<PresenceRow>
            setRows((r) =>
              r.filter((x) => x.member_id !== old.member_id)
            )
            if (old.member_id === me.id) setInRoom(false)
            return
          }
          const next = payload.new as PresenceRow
          setRows((r) => {
            const idx = r.findIndex((x) => x.member_id === next.member_id)
            if (idx === -1) return [...r, next]
            const copy = r.slice()
            copy[idx] = next
            return copy
          })
        }
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [companyId, me.id])

  // Drive the heartbeat interval based on whether we're in the room.
  useEffect(() => {
    if (!inRoom) {
      if (heartbeatIdRef.current) {
        clearInterval(heartbeatIdRef.current)
        heartbeatIdRef.current = null
      }
      return
    }
    heartbeatIdRef.current = setInterval(() => {
      heartbeatQuickRoom().catch(() => {})
    }, HEARTBEAT_MS)
    return () => {
      if (heartbeatIdRef.current) {
        clearInterval(heartbeatIdRef.current)
        heartbeatIdRef.current = null
      }
    }
  }, [inRoom])

  // Hide stale rows (last_heartbeat older than STALE_MS). Server sweeps
  // them eventually; this is just the immediate UI mask.
  const present = useMemo(() => {
    const cutoff = nowTick - STALE_MS
    return rows
      .filter((r) => new Date(r.last_heartbeat).getTime() >= cutoff)
      .sort(
        (a, b) =>
          new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      )
  }, [rows, nowTick])

  const join = useCallback(async () => {
    if (!meetUrl) return
    const res = await joinQuickRoom()
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setInRoom(true)
    if (typeof window !== 'undefined') {
      window.open(meetUrl, '_blank', 'noopener,noreferrer')
    }
  }, [meetUrl])

  const leave = useCallback(async () => {
    const res = await leaveQuickRoom()
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setInRoom(false)
  }, [])

  async function copyUrl() {
    if (!meetUrl || typeof navigator === 'undefined') return
    await navigator.clipboard.writeText(meetUrl)
    toast.success('Room URL copied')
  }

  const presentIds = useMemo(
    () => new Set(present.map((p) => p.member_id)),
    [present]
  )
  const invitableMembers = useMemo(
    () =>
      team.filter(
        (m) => m.id !== me.id && !presentIds.has(m.id)
      ),
    [team, me.id, presentIds]
  )

  const stack = present.slice(0, 3)
  const overflow = present.length - stack.length

  const configured = Boolean(meetUrl)
  const canJoin = configured && window_.open
  const disabledTitle = !configured
    ? isAdmin
      ? 'No quick room URL set yet.'
      : 'Ask an admin to set the quick room URL.'
    : !window_.open
      ? window_.label
      : ''

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick meeting room"
        title={
          present.length > 0
            ? `${present.length} in the room`
            : 'Quick room'
        }
        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${
          open ? t.btnActive : t.btn
        }`}
      >
        <Video className={`size-3.5 ${t.textSubtle}`} />
        {present.length === 0 ? (
          <span className={`text-[11px] ${t.textMuted}`}>Quick room</span>
        ) : (
          <div className="flex items-center -space-x-1.5">
            {stack.map((p) => {
              const member = team.find((m) => m.id === p.member_id) ?? {
                id: p.member_id,
                name: 'Member',
                initials: '??',
                color: 'bg-zinc-400'
              }
              return (
                <span
                  key={p.member_id}
                  className="ring-background rounded-full ring-1"
                >
                  <Avatar user={member as BoardAssignee} size={18} />
                </span>
              )
            })}
            {overflow > 0 && (
              <span
                className={`ring-background flex size-4.5 items-center justify-center rounded-full text-[9px] font-semibold ring-1 ${t.surfaceMuted} ${t.text}`}
              >
                +{overflow}
              </span>
            )}
          </div>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-9 right-0 z-40 w-72 rounded-md border py-2 shadow-xl ${t.detail}`}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className={`text-xs font-medium ${t.text}`}>Quick room</span>
            <span className={`text-[10px] ${t.textSubtle}`}>
              {present.length} in the room
            </span>
          </div>
          <div className={`my-1 border-t ${t.borderSoft}`} />

          {!configured ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              <p className={`text-[11px] leading-relaxed ${t.textMuted}`}>
                {isAdmin
                  ? 'No quick room URL set yet. Paste a Google Meet link in settings to enable.'
                  : 'No quick room URL set yet. Ask an admin to add one in settings.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings()
                    setOpen(false)
                  }}
                  className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
                >
                  Open settings
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 px-3 py-1">
                {inRoom ? (
                  <button
                    type="button"
                    onClick={leave}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs transition ${t.border} ${t.tab}`}
                  >
                    <LogOut className="size-3.5" /> Leave room
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={join}
                    disabled={!canJoin}
                    title={disabledTitle}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-teal-500 bg-teal-500 px-2 text-xs font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogIn className="size-3.5" /> Join
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyUrl}
                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs transition ${t.border} ${t.tab}`}
                >
                  <Copy className="size-3.5" /> Copy URL
                </button>
                {!window_.open && (
                  <span
                    className={`text-center text-[10px] italic ${t.textSubtle}`}
                  >
                    {window_.label}
                  </span>
                )}
              </div>

              {present.length > 0 && (
                <>
                  <div className={`my-1 border-t ${t.borderSoft}`} />
                  <div className="flex flex-col gap-1 px-3 py-1">
                    <span
                      className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
                    >
                      In the room
                    </span>
                    <ul className="flex flex-col gap-1">
                      {present.map((p) => {
                        const member = team.find((m) => m.id === p.member_id)
                        return (
                          <li
                            key={p.member_id}
                            className="flex items-center gap-2"
                          >
                            {member ? (
                              <Avatar user={member} size={18} />
                            ) : (
                              <span
                                className={`size-4.5 rounded-full ${t.surfaceMuted}`}
                              />
                            )}
                            <span className={`truncate text-[11px] ${t.text}`}>
                              {member?.name ?? 'Member'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </>
              )}

              <div className={`my-1 border-t ${t.borderSoft}`} />
              <InviteList
                members={invitableMembers}
                disabled={!window_.open}
                disabledLabel={window_.open ? '' : window_.label}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InviteList({
  members,
  disabled,
  disabledLabel
}: {
  members: BoardAssignee[]
  disabled: boolean
  disabledLabel: string
}) {
  const { t } = useDashTheme()
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members.slice(0, 8)
    return members
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [members, query])

  async function invite(id: string) {
    if (disabled || sending) return
    setSending(id)
    const res = await inviteToQuickRoom([id])
    setSending(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setSent((s) => new Set(s).add(id))
    toast.success('Invite sent')
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-1">
      <span className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}>
        Invite a teammate
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search teammates..."
        disabled={disabled}
        title={disabled ? disabledLabel : ''}
        className={`h-7 w-full rounded-md border px-2 text-[11px] ${t.input} disabled:opacity-50`}
      />
      {members.length === 0 ? (
        <span className={`text-[10px] italic ${t.textSubtle}`}>
          Everyone&apos;s already in the room.
        </span>
      ) : filtered.length === 0 ? (
        <span className={`text-[10px] italic ${t.textSubtle}`}>
          No matches.
        </span>
      ) : (
        <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
          {filtered.map((m) => {
            const isSent = sent.has(m.id)
            const isSending = sending === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => invite(m.id)}
                  disabled={disabled || isSent || isSending}
                  title={disabled ? disabledLabel : ''}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition ${t.tab} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Avatar user={m} size={16} />
                  <span className={`flex-1 truncate ${t.text}`}>{m.name}</span>
                  {isSent ? (
                    <Check className="size-3 text-teal-500" />
                  ) : (
                    <UserPlus className={`size-3 ${t.textSubtle}`} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
