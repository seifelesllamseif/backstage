'use client'

import {
  Inbox,
  LayoutGrid,
  Star,
  Users,
  Bell,
  Settings,
  Folder,
  Shapes,
  Archive as ArchiveIcon
} from 'lucide-react'
import { STATUSES, TaskStatus } from './status'
import StatusIcon from './StatusIcon'
import { useTeam } from './TeamContext'
import Avatar from './Avatar'
import { useDashTheme } from './theme'
import { useContextMenu } from './ContextMenu'
import { useTaskActions } from './actions'
import { Filter, X } from 'lucide-react'

type View =
  | 'all'
  | 'mine'
  | 'inbox'
  | 'projects'
  | 'updates'
  | 'settings'
  | 'symbols'
  | 'archive'

interface SidebarProps {
  activeView: 'all' | 'mine' | 'inbox'
  onView: (v: 'all' | 'mine' | 'inbox') => void
  statusFilter: TaskStatus | null
  onStatusFilter: (s: TaskStatus | null) => void
  assigneeFilter: string | null
  onAssigneeFilter: (id: string | null) => void
  counts: { all: number; mine: number; inbox: number }
  secondary: View
  onSecondary: (v: View) => void
}

export default function Sidebar({
  activeView,
  onView,
  statusFilter,
  onStatusFilter,
  assigneeFilter,
  onAssigneeFilter,
  counts,
  secondary,
  onSecondary
}: SidebarProps) {
  const { t } = useDashTheme()
  const { open } = useContextMenu()
  const a = useTaskActions()
  const team = useTeam()

  const memberMenu = (e: React.MouseEvent, memberId: string, memberName: string) => {
    open(e, [
      {
        id: 'filter',
        label: `Filter by ${memberName}`,
        icon: <Filter className="size-3.5" />,
        onSelect: () => a.setAssigneeFilter(memberId)
      },
      {
        id: 'clear-filter',
        label: 'Clear assignee filter',
        icon: <X className="size-3.5" />,
        disabled: assigneeFilter !== memberId,
        onSelect: () => a.setAssigneeFilter(null)
      }
    ])
  }

  const statusMenu = (e: React.MouseEvent, s: TaskStatus, label: string) => {
    open(e, [
      {
        id: 'filter',
        label: `Filter by ${label}`,
        icon: <Filter className="size-3.5" />,
        onSelect: () => onStatusFilter(s)
      },
      {
        id: 'clear-filter',
        label: 'Clear status filter',
        icon: <X className="size-3.5" />,
        disabled: statusFilter !== s,
        onSelect: () => onStatusFilter(null)
      }
    ])
  }

  return (
    <aside
      className={`h-full overflow-y-auto flex flex-col gap-5 border-r px-3 py-4 min-w-0 ${t.sidebar}`}
    >
      <div className="flex items-center gap-2 px-2">
        <div className="size-6 rounded bg-red-500 flex items-center justify-center text-white text-[11px] font-bold">
          S
        </div>
        <div className="flex flex-col leading-none">
          <span
            className={`text-[11px] uppercase tracking-[0.25em] ${t.textMuted}`}
          >
            Skam
          </span>
          <span className={`text-xs ${t.text}`}>Workspace</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        <SidebarItem
          icon={<LayoutGrid className="size-3.5" />}
          label="All tasks"
          count={counts.all}
          active={secondary === 'all'}
          onClick={() => onView('all')}
        />
        <SidebarItem
          icon={<Star className="size-3.5" />}
          label="My tasks"
          count={counts.mine}
          active={secondary === 'mine'}
          onClick={() => onView('mine')}
        />
        <SidebarItem
          icon={<Inbox className="size-3.5" />}
          label="Inbox"
          count={counts.inbox}
          active={secondary === 'inbox'}
          onClick={() => onView('inbox')}
        />
        <SidebarItem
          icon={<ArchiveIcon className="size-3.5" />}
          label="Archive"
          active={secondary === 'archive'}
          onClick={() => onSecondary('archive')}
        />
      </nav>

      <div className="flex flex-col gap-1">
        <div
          className={`px-2 text-[10px] uppercase tracking-[0.22em] mb-1 ${t.textMuted}`}
        >
          Status
        </div>
        <SidebarFilter
          active={statusFilter === null}
          onClick={() => onStatusFilter(null)}
        >
          <span
            className={`size-3.5 rounded-full inline-block ${
              statusFilter === null ? 'bg-zinc-400' : 'bg-zinc-300'
            }`}
          />
          Any
        </SidebarFilter>
        {STATUSES.map((s) => (
          <SidebarFilter
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => onStatusFilter(s.id)}
            onContextMenu={(e) => statusMenu(e, s.id, s.label)}
          >
            <StatusIcon status={s.id} className="size-3.5" />
            {s.label}
          </SidebarFilter>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div
          className={`px-2 text-[10px] uppercase tracking-[0.22em] mb-1 flex items-center gap-2 ${t.textMuted}`}
        >
          <Users className="size-3" /> Team
        </div>
        <SidebarFilter
          active={assigneeFilter === null}
          onClick={() => onAssigneeFilter(null)}
        >
          <span
            className={`size-5 rounded-full text-[9px] font-semibold flex items-center justify-center ${
              t.text
            } ${assigneeFilter === null ? 'bg-zinc-200' : 'bg-zinc-100'}`}
          >
            All
          </span>
          Everyone
        </SidebarFilter>
        {team.map((m) => (
          <SidebarFilter
            key={m.id}
            active={assigneeFilter === m.id}
            onClick={() => onAssigneeFilter(m.id)}
            onContextMenu={(e) => memberMenu(e, m.id, m.name)}
          >
            <Avatar user={m} size={20} />
            <span className="truncate">{m.name}</span>
          </SidebarFilter>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <SidebarItem
          icon={<Folder className="size-3.5" />}
          label="Projects"
          active={secondary === 'projects'}
          onClick={() => onSecondary('projects')}
        />
        <SidebarItem
          icon={<Bell className="size-3.5" />}
          label="Updates"
          active={secondary === 'updates'}
          onClick={() => onSecondary('updates')}
        />
        <SidebarItem
          icon={<Shapes className="size-3.5" />}
          label="Symbols"
          active={secondary === 'symbols'}
          onClick={() => onSecondary('symbols')}
        />
        <SidebarItem
          icon={<Settings className="size-3.5" />}
          label="Settings"
          active={secondary === 'settings'}
          onClick={() => onSecondary('settings')}
        />
      </div>
    </aside>
  )
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  onClick?: () => void
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
        active ? t.btnActive : `${t.tab}`
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {count !== undefined && (
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function SidebarFilter({
  children,
  active,
  onClick,
  onContextMenu
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const { t } = useDashTheme()
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
        active ? t.btnActive : t.tab
      }`}
    >
      {children}
    </button>
  )
}
