'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crown,
  Mail,
  MoreHorizontal,
  Pencil,
  Plane,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  X
} from 'lucide-react'

import {
  cancelInvite,
  changeAccessTier,
  inviteMember,
  listTeamRoster,
  setMemberPresence,
  updateMemberProfileByAdmin
} from '../actions'
import Avatar from './Avatar'
import { useDashTheme } from './theme'
import {
  canCancelInvite,
  canChangeTier,
  canEditProfile,
  canInvite,
  canSoftRemove,
  type AccessTier,
  type Actor,
  type Target
} from '@/lib/teamGate'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import type { BoardAssignee } from './boardData'

type PresenceValue = 'active' | 'on_vacation' | 'left'
type RoleFilter = 'admin' | 'lead' | 'member'
type StatusFilter = 'active' | 'away' | 'on_vacation' | 'left'

interface RosterMember {
  id: string
  fullName: string
  email: string
  contactEmail: string | null
  avatarUrl: string | null
  headline: string | null
  accessTier: AccessTier
  activityStatus: 'active' | 'away' | 'on_vacation' | 'left'
  lastSeenAt: string | null
  isOwner: boolean
}

interface RosterInvite {
  id: string
  email: string
  fullName: string
  accessTier: AccessTier
  invitedAt: string
  expiresAt: string
  invitedById: string | null
  invitedByName: string | null
}

const PRESENCE_LABELS: Record<PresenceValue, string> = {
  active: 'Active',
  on_vacation: 'On vacation',
  left: 'Left'
}

// Mirrors slugifyForLogin in supabase/dashboard/team.ts so the invite
// modal can preview the @verbivore.app login the recipient will get.
// Keep these two in sync if you change the slug rules.
function previewLoginEmail(fullName: string): string {
  const cleaned = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const handle = parts.length === 0 ? 'member' : parts.join('.')
  return `${handle}@verbivore.app`
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  active: 'Active',
  away: 'Away',
  on_vacation: 'On vacation',
  left: 'Left'
}

export function TeamPanel({ actor }: { actor: Actor }) {
  const { t } = useDashTheme()
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<RosterMember | null>(null)
  const [pendingMember, setPendingMember] = useState<string | null>(null)

  // Selection + filter state.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Set<RoleFilter>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set())

  // Bulk confirmation modal.
  const [bulkConfirm, setBulkConfirm] = useState<null | {
    status: PresenceValue
    memberIds: string[]
  }>(null)

  // Per-row delete confirmation (Delete = soft-remove via status='left').
  const [deleteConfirm, setDeleteConfirm] = useState<RosterMember | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['teamRoster'],
    queryFn: async () => {
      const res = await listTeamRoster()
      if ('error' in res) throw new Error(res.error)
      return res.roster
    }
  })

  const members = data?.members ?? []
  const invites = data?.invites ?? []

  // Apply filters. Search hits name + email + contact email. Role and
  // status are multi-select unions ("show me admins OR leads"), with
  // empty meaning "no constraint on that axis".
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter.size > 0 && !roleFilter.has(m.accessTier)) return false
      if (statusFilter.size > 0 && !statusFilter.has(m.activityStatus))
        return false
      if (!q) return true
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.contactEmail?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [members, search, roleFilter, statusFilter])

  // Only rows the actor can act on get a checkbox. Drives both
  // select-all and the bulk button gating.
  const actionableIds = useMemo(() => {
    return filteredMembers
      .filter((m) =>
        canSoftRemove(actor, {
          id: m.id,
          accessTier: m.accessTier,
          isOwner: m.isOwner
        })
      )
      .map((m) => m.id)
  }, [filteredMembers, actor])

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['teamRoster'] })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const allSelected = actionableIds.every((id) => selected.has(id))
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        actionableIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        actionableIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  async function onChangeTier(member: RosterMember, newTier: AccessTier) {
    setPendingMember(member.id)
    const res = await changeAccessTier({ memberId: member.id, newTier })
    setPendingMember(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`${member.fullName} is now ${newTier}.`)
    refetch()
  }

  async function onChangePresence(member: RosterMember, status: PresenceValue) {
    setPendingMember(member.id)
    const res = await setMemberPresence({ memberId: member.id, status })
    setPendingMember(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`${member.fullName} - ${PRESENCE_LABELS[status]}.`)
    refetch()
  }

  async function applyBulkPresence(status: PresenceValue, memberIds: string[]) {
    // Fire in parallel. The server-side gate enforces correctness; the
    // UI gate just filters which rows are checkboxable in the first place.
    const results = await Promise.all(
      memberIds.map((id) => setMemberPresence({ memberId: id, status }))
    )
    const failed = results.filter((r) => 'error' in r).length
    const ok = results.length - failed
    if (ok > 0)
      toast.success(`${ok} member${ok === 1 ? '' : 's'} - ${PRESENCE_LABELS[status]}.`)
    if (failed > 0) toast.error(`${failed} failed.`)
    clearSelection()
    refetch()
  }

  function onBulkPresence(status: PresenceValue) {
    const ids = Array.from(selected).filter((id) => actionableIds.includes(id))
    if (ids.length === 0) return
    // Confirm before the more impactful changes.
    if (status === 'left' || status === 'on_vacation') {
      setBulkConfirm({ status, memberIds: ids })
      return
    }
    applyBulkPresence(status, ids)
  }

  async function onCancelInvite(invite: RosterInvite) {
    const res = await cancelInvite(invite.id)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(`Invite to ${invite.email} canceled.`)
    refetch()
  }

  const allFilteredChecked =
    actionableIds.length > 0 &&
    actionableIds.every((id) => selected.has(id))

  const columns = useMemo<ColumnDef<RosterMember>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allFilteredChecked}
            disabled={actionableIds.length === 0}
            onChange={() => toggleAll()}
            className="size-3.5 cursor-pointer accent-teal-600"
          />
        ),
        cell: ({ row }) => {
          const m = row.original
          const target = {
            id: m.id,
            accessTier: m.accessTier,
            isOwner: m.isOwner
          }
          if (!canSoftRemove(actor, target)) return null
          return (
            <input
              type="checkbox"
              aria-label={`Select ${m.fullName}`}
              checked={selected.has(m.id)}
              onChange={() => toggleOne(m.id)}
              className="size-3.5 cursor-pointer accent-teal-600"
            />
          )
        }
      },
      {
        accessorKey: 'fullName',
        header: 'Name',
        cell: ({ row }) => {
          const m = row.original
          const user: BoardAssignee = {
            id: m.id,
            name: m.fullName,
            initials: m.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? '')
              .join(''),
            color: 'bg-zinc-500',
            photo: m.avatarUrl ?? undefined,
            activityStatus:
              m.activityStatus === 'away' ? 'active' : m.activityStatus,
            lastSeenAt: m.lastSeenAt
          }
          return (
            <div className="flex items-center gap-2.5">
              <Avatar user={user} size={28} />
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium ${t.text}`}>
                    {m.fullName}
                  </span>
                  {m.isOwner && (
                    <span
                      title="Workspace owner"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                    >
                      <Crown className="size-3" /> Owner
                    </span>
                  )}
                </div>
                {m.headline && (
                  <span className={`text-[11px] ${t.textSubtle}`}>
                    {m.headline}
                  </span>
                )}
              </div>
            </div>
          )
        }
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="flex flex-col leading-tight">
              <span className={`text-xs ${t.text}`}>{m.email}</span>
              {m.contactEmail && m.contactEmail !== m.email && (
                <span className={`text-[10px] ${t.textSubtle}`}>
                  Contact: {m.contactEmail}
                </span>
              )}
            </div>
          )
        }
      },
      {
        accessorKey: 'accessTier',
        header: 'Role',
        cell: ({ row }) => {
          const m = row.original
          const target = {
            id: m.id,
            accessTier: m.accessTier,
            isOwner: m.isOwner
          }
          const canEdit =
            !m.isOwner &&
            (canChangeTier(actor, target, 'admin') ||
              canChangeTier(actor, target, 'lead') ||
              canChangeTier(actor, target, 'member'))
          if (!canEdit) {
            return (
              <span className={`text-xs capitalize ${t.text}`}>
                {m.accessTier}
              </span>
            )
          }
          return (
            <select
              value={m.accessTier}
              disabled={pendingMember === m.id}
              onChange={(e) => onChangeTier(m, e.target.value as AccessTier)}
              className={`h-7 rounded border bg-transparent px-1.5 text-xs capitalize transition disabled:opacity-50 ${t.border} ${t.text}`}
            >
              {(['admin', 'lead', 'member'] as const).map((tier) => {
                const allowed =
                  tier === m.accessTier ||
                  canChangeTier(actor, target, tier)
                return (
                  <option key={tier} value={tier} disabled={!allowed}>
                    {tier}
                  </option>
                )
              })}
            </select>
          )
        }
      },
      {
        accessorKey: 'activityStatus',
        header: 'Status',
        cell: ({ row }) => {
          const m = row.original
          const target: Target = {
            id: m.id,
            accessTier: m.accessTier,
            isOwner: m.isOwner
          }
          const canEdit = canSoftRemove(actor, target)
          // 'away' is a display-only derivation - never persisted via
          // the dropdown. Map it back to 'active' when present.
          const currentValue: PresenceValue =
            m.activityStatus === 'away' ? 'active' : m.activityStatus
          if (!canEdit) {
            return (
              <span className={`text-xs ${t.textSubtle}`}>
                {m.activityStatus === 'away'
                  ? 'Away'
                  : PRESENCE_LABELS[currentValue]}
              </span>
            )
          }
          return (
            <select
              value={currentValue}
              disabled={pendingMember === m.id}
              onChange={(e) =>
                onChangePresence(m, e.target.value as PresenceValue)
              }
              className={`h-7 rounded border bg-transparent px-1.5 text-xs transition disabled:opacity-50 ${t.border} ${t.text}`}
            >
              <option value="active">Active</option>
              <option value="on_vacation">On vacation</option>
              <option value="left">Left</option>
            </select>
          )
        }
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const m = row.original
          const target = {
            id: m.id,
            accessTier: m.accessTier,
            isOwner: m.isOwner
          }
          const canEdit = canEditProfile(actor, target)
          const canDelete = canSoftRemove(actor, target)
          if (!canEdit && !canDelete) return null
          return (
            <div className="flex justify-end">
              <RowActionsMenu
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleteConfirm(m)}
              />
            </div>
          )
        }
      }
    ],
    [
      actor,
      pendingMember,
      selected,
      allFilteredChecked,
      actionableIds,
      t
    ]
  )

  const table = useReactTable({
    data: filteredMembers,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  const canInviteAny =
    canInvite(actor, 'member') ||
    canInvite(actor, 'lead') ||
    canInvite(actor, 'admin')

  const selectionCount = Array.from(selected).filter((id) =>
    actionableIds.includes(id)
  ).length

  const filtersActive =
    !!search ||
    roleFilter.size > 0 ||
    statusFilter.size > 0

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className={`text-lg font-medium ${t.text}`}>Team</h2>
          <p className={`text-xs ${t.textSubtle}`}>
            Add, remove, and manage roles for everyone in the workspace.
          </p>
        </div>
        {canInviteAny && (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-600 px-3 text-xs font-medium text-white transition hover:bg-teal-700"
          >
            <UserPlus className="size-3.5" /> Invite member
          </button>
        )}
      </div>

      {/* Filters - faceted-filter buttons on the left, search + clear on the
          right. No outer container, matches the toolbar pattern across the
          rest of the dashboard. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FacetedFilter
          title="Role"
          values={['admin', 'lead', 'member']}
          selected={roleFilter}
          onToggle={(v) => {
            setRoleFilter((prev) => {
              const next = new Set(prev)
              if (next.has(v)) next.delete(v)
              else next.add(v)
              return next
            })
          }}
        />
        <FacetedFilter
          title="Status"
          values={['active', 'away', 'on_vacation', 'left']}
          labelMap={STATUS_FILTER_LABELS}
          selected={statusFilter}
          onToggle={(v) => {
            setStatusFilter((prev) => {
              const next = new Set(prev)
              if (next.has(v)) next.delete(v)
              else next.add(v)
              return next
            })
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 ${t.textSubtle}`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className={`h-8 w-[200px] rounded-md border bg-transparent pr-2 pl-7 text-xs lg:w-[250px] ${t.border} ${t.text}`}
            />
          </div>
          <button
            onClick={() => {
              setSearch('')
              setRoleFilter(new Set())
              setStatusFilter(new Set())
            }}
            disabled={!filtersActive}
            title="Clear filters"
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] transition disabled:cursor-default disabled:opacity-40 ${t.border} ${t.btn}`}
          >
            <X className="size-3" /> Clear
          </button>
        </div>
      </div>

      {/* Bulk actions bar - always mounted so the open/close transition
          can run on max-height + opacity + translate together. Pointer
          events get disabled when collapsed so focus and clicks fall
          through to the table below. */}
      <div
        aria-hidden={selectionCount === 0}
        className={`overflow-hidden transition-[max-height,opacity,margin,transform] duration-200 ease-out ${
          selectionCount > 0
            ? 'mb-3 max-h-24 translate-y-0 opacity-100'
            : 'pointer-events-none mb-0 max-h-0 -translate-y-1 opacity-0'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2`}
        >
          <span className="text-xs font-medium text-teal-900">
            {selectionCount} selected
          </span>
          <div className="flex items-center gap-1">
            <BulkPill
              onClick={() => onBulkPresence('active')}
              icon={<UserCheck className="size-3" />}
              label="Active"
            />
            <BulkPill
              onClick={() => onBulkPresence('on_vacation')}
              icon={<Plane className="size-3" />}
              label="On vacation"
            />
            <BulkPill
              onClick={() => onBulkPresence('left')}
              icon={<UserMinus className="size-3" />}
              label="Left"
            />
            <button
              onClick={clearSelection}
              className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-teal-900/70 transition hover:bg-teal-100 hover:text-teal-900"
            >
              <X className="size-3" /> Clear
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <p className={`text-xs ${t.textSubtle}`}>Loading roster…</p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="size-3.5" />
          {(error as Error).message}
        </div>
      )}

      {invites.length > 0 && (
        <div className={`mb-3 rounded-lg border ${t.border}`}>
          <div className={`border-b px-3 py-2 ${t.border}`}>
            <span className={`text-xs font-medium ${t.text}`}>
              Pending invites ({invites.length})
            </span>
          </div>
          <ul>
            {invites.map((inv) => {
              const can = canCancelInvite(actor, inv.accessTier)
              return (
                <li
                  key={inv.id}
                  className={`flex items-center justify-between border-b px-3 py-2 last:border-b-0 ${t.border}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className={`size-3.5 ${t.textSubtle}`} />
                    <div className="flex flex-col leading-tight">
                      <span className={`text-xs font-medium ${t.text}`}>
                        {inv.fullName}
                      </span>
                      <span className={`text-[11px] ${t.textSubtle}`}>
                        {inv.email} · {inv.accessTier}
                        {inv.invitedByName
                          ? ` · by ${inv.invitedByName}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  {can && (
                    <button
                      onClick={() => onCancelInvite(inv)}
                      title="Cancel invite"
                      className={`flex size-7 items-center justify-center rounded border transition ${t.border} ${t.btn}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className={`rounded-lg border ${t.border}`}>
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className={`border-b ${t.border}`}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide ${t.textSubtle}`}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b last:border-b-0 ${t.border} ${
                  row.original.activityStatus === 'left' ? 'opacity-60' : ''
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && filteredMembers.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`px-3 py-6 text-center text-xs ${t.textSubtle}`}
                >
                  {members.length === 0
                    ? 'No team members yet.'
                    : 'No matches for these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InviteModal
        open={inviteOpen}
        actor={actor}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false)
          refetch()
        }}
      />

      <EditProfileSheet
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          refetch()
        }}
      />

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          {deleteConfirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {deleteConfirm.fullName}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  They will be marked as Left and removed from active views.
                  You can reinstate them from this page later by switching
                  their status back to Active.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const m = deleteConfirm
                    setDeleteConfirm(null)
                    onChangePresence(m, 'left')
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!bulkConfirm}
        onOpenChange={(o) => !o && setBulkConfirm(null)}
      >
        <AlertDialogContent>
          {bulkConfirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Mark {bulkConfirm.memberIds.length}{' '}
                  member{bulkConfirm.memberIds.length === 1 ? '' : 's'} as{' '}
                  {PRESENCE_LABELS[bulkConfirm.status]}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {bulkConfirm.status === 'left'
                    ? 'They will disappear from active views. You can mark them Active again later.'
                    : 'They will be marked on vacation. You can mark them Active again later.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const c = bulkConfirm
                    setBulkConfirm(null)
                    applyBulkPresence(c.status, c.memberIds)
                  }}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Per-row kebab menu. Same popover pattern as FacetedFilter (anchored,
// click-outside + Esc to close). Hidden when the actor has no allowed
// actions on the row.
function RowActionsMenu({
  canEdit,
  canDelete,
  onEdit,
  onDelete
}: {
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useDashTheme()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Actions"
        className={`flex size-7 items-center justify-center rounded border transition ${t.border} ${t.btn}`}
      >
        <MoreHorizontal className="size-3.5" />
      </button>
      {open && (
        <div
          className={`absolute top-full right-0 z-30 mt-1 min-w-[140px] rounded-md border bg-white p-1 shadow-lg dark:bg-zinc-900 ${t.border}`}
        >
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${t.text}`}
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function BulkPill({
  onClick,
  icon,
  label
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-teal-300/60 bg-white px-2 text-[11px] font-medium text-teal-900 transition hover:border-teal-400 hover:bg-teal-50"
    >
      {icon} {label}
    </button>
  )
}

// Single "Role" / "Status" button that opens a checkbox-list popover.
// Inspired by shadcn's DataTableFacetedFilter. Click-outside closes;
// Esc closes too. Always renders the trigger so layout doesn't shift
// when filters get applied / cleared.
function FacetedFilter<T extends string>({
  title,
  values,
  selected,
  onToggle,
  labelMap
}: {
  title: string
  values: T[]
  selected: Set<T>
  onToggle: (v: T) => void
  labelMap?: Record<T, string>
}) {
  const { t } = useDashTheme()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = selected.size

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border bg-transparent px-2.5 text-xs transition ${t.border} ${t.btn} ${
          count > 0 ? 'border-dashed' : ''
        }`}
      >
        <span className={t.textSubtle}>{title}</span>
        {count > 0 && (
          <>
            <span className="mx-1 h-3 w-px bg-current opacity-20" />
            <span className={`font-medium ${t.text}`}>
              {count === 1
                ? labelMap?.[Array.from(selected)[0]] ??
                  Array.from(selected)[0]
                : `${count} selected`}
            </span>
          </>
        )}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 z-30 mt-1 min-w-[180px] rounded-md border bg-white p-1 shadow-lg dark:bg-zinc-900 ${t.border}`}
        >
          {values.map((v) => {
            const isOn = selected.has(v)
            const display = labelMap?.[v] ?? v
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggle(v)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs capitalize transition hover:bg-zinc-100 dark:hover:bg-zinc-800`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded border ${
                    isOn
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : `${t.border} bg-transparent`
                  }`}
                >
                  {isOn && <Check className="size-3" />}
                </span>
                <span className={t.text}>{display}</span>
              </button>
            )
          })}
          {count > 0 && (
            <>
              <div className={`my-1 border-t ${t.border}`} />
              <button
                type="button"
                onClick={() => {
                  Array.from(selected).forEach((v) => onToggle(v))
                }}
                className={`w-full rounded px-2 py-1.5 text-center text-[11px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${t.textSubtle}`}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InviteModal({
  open,
  actor,
  onClose,
  onInvited
}: {
  open: boolean
  actor: Actor
  onClose: () => void
  onInvited: () => void
}) {
  const { t } = useDashTheme()
  const [contactEmail, setContactEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [accessTier, setAccessTier] = useState<AccessTier>('member')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setContactEmail('')
      setFullName('')
      setAccessTier('member')
      setError(null)
    }
  }, [open])

  const tierOptions = (['member', 'lead', 'admin'] as const).filter((tier) =>
    canInvite(actor, tier)
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await inviteMember({ contactEmail, fullName, accessTier })
      if ('error' in res) {
        setError(res.error)
        return
      }
      toast.success(`Invite sent to ${contactEmail}.`)
      onInvited()
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-lg border bg-white p-5 shadow-xl ${t.border}`}
      >
        <h3 className={`text-base font-medium ${t.text}`}>Invite a teammate</h3>
        <p className={`mt-1 text-xs ${t.textSubtle}`}>
          We will generate a <span className="font-mono">@verbivore.app</span>{' '}
          login from their name and email the invite to the contact email
          you enter below.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={`text-xs font-medium ${t.text}`}>Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={`h-9 rounded-md border px-3 text-sm ${t.border} ${t.text}`}
              placeholder="Jane Doe"
            />
            {fullName.trim() && (
              <span className={`text-[10px] ${t.textSubtle}`}>
                Login will be{' '}
                <span className="font-mono">
                  {previewLoginEmail(fullName)}
                </span>
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className={`text-xs font-medium ${t.text}`}>Contact email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              className={`h-9 rounded-md border px-3 text-sm ${t.border} ${t.text}`}
              placeholder="jane@example.com"
            />
            <span className={`text-[10px] ${t.textSubtle}`}>
              We send the invite here. The recipient signs in with the
              generated login above.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className={`text-xs font-medium ${t.text}`}>Role</span>
            <select
              value={accessTier}
              onChange={(e) => setAccessTier(e.target.value as AccessTier)}
              className={`h-9 rounded-md border bg-transparent px-2 text-sm ${t.border} ${t.text}`}
            >
              {tierOptions.map((tier) => (
                <option key={tier} value={tier} className="capitalize">
                  {tier}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`h-8 rounded-md border px-3 text-xs transition ${t.border} ${t.btn}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-8 rounded-md bg-teal-600 px-3 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditProfileSheet({
  member,
  onClose,
  onSaved
}: {
  member: RosterMember | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useDashTheme()
  const [fullName, setFullName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [headline, setHeadline] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (member) {
      setFullName(member.fullName)
      setContactEmail(member.contactEmail ?? '')
      setHeadline(member.headline ?? '')
      setError(null)
    }
  }, [member])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setError(null)
    startTransition(async () => {
      const res = await updateMemberProfileByAdmin({
        memberId: member.id,
        fullName,
        contactEmail: contactEmail || null,
        headline: headline || null
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      toast.success(`${fullName} updated.`)
      onSaved()
    })
  }

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
        </SheetHeader>
        {member && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3 px-4">
            <label className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${t.text}`}>Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={`h-9 rounded-md border px-3 text-sm ${t.border} ${t.text}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${t.text}`}>
                Contact email
              </span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={`h-9 rounded-md border px-3 text-sm ${t.border} ${t.text}`}
                placeholder={member.email}
              />
              <span className={`text-[10px] ${t.textSubtle}`}>
                Login email stays {member.email}.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${t.text}`}>Headline</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={140}
                className={`h-9 rounded-md border px-3 text-sm ${t.border} ${t.text}`}
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`h-8 rounded-md border px-3 text-xs transition ${t.border} ${t.btn}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-8 rounded-md bg-teal-600 px-3 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
