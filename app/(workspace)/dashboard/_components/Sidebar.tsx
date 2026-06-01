'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AtSign,
  Info,
  LayoutGrid,
  Star,
  Target,
  Users,
  Bell,
  Settings,
  Folder,
  Shapes,
  Compass,
  UserCog,
  Archive as ArchiveIcon
} from 'lucide-react'
import { STATUSES, TaskStatus } from './status'
import StatusIcon from './StatusIcon'
import { useTeam } from './TeamContext'
import Avatar from './Avatar'
import { startDashboardTour } from './DashboardTour'
import { getPresence, PRESENCE_LABEL, presenceRank } from './presence'
import { usePortfolioSheet } from './PortfolioSheet'
import { useDashTheme } from './theme'
import { useContextMenu } from './ContextMenu'
import { useTaskActions } from './actions'
import { Filter, X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

// Single source of truth for what each sidebar destination does. Plain
// language; what a member sees, not implementation. Toggled by the
// "Show help hints" setting (Settings panel → DashboardShell state).
const HINTS = {
  all: 'Every task in your projects.',
  mine: 'Tasks assigned to you.',
  inbox: 'Todo + In Review in the active sprint.',
  mentions: 'Tasks where someone @-mentioned you in a comment.',
  archive: 'Completed sprints and old tasks.',
  projects: 'Discover and switch to another project',
  updates:
    'Recent activity on your projects. Status changes, comments, mentions.',
  symbols: 'Reference for the status and priority icons used on cards.',
  settings: 'Card density, WIP limits, notifications, and help hints.'
} as const

type View =
  | 'all'
  | 'mine'
  | 'inbox'
  | 'mentions'
  | 'projects'
  | 'updates'
  | 'settings'
  | 'symbols'
  | 'archive'

interface SidebarProps {
  activeView: 'all' | 'mine' | 'inbox' | 'mentions'
  onView: (v: 'all' | 'mine' | 'inbox' | 'mentions') => void
  // Multi-select: an empty array means "no filter on this axis". Toggle
  // membership by passing a single value to the corresponding callback.
  statusFilter: TaskStatus[]
  onToggleStatus: (s: TaskStatus) => void
  onClearStatus: () => void
  assigneeFilter: string[]
  onToggleAssignee: (id: string) => void
  onClearAssignee: () => void
  counts: { all: number; mine: number; inbox: number; mentions: number }
  secondary: View
  onSecondary: (v: View) => void
  showHints: boolean
  currentUserId: string
  // When true, the bottom "Finish your profile" / "Take a tour" block hides
  // from the sidebar; those entries move into the Settings panel instead.
  onboardingComplete: boolean
}

export default function Sidebar({
  onView,
  statusFilter,
  onToggleStatus,
  onClearStatus,
  assigneeFilter,
  onToggleAssignee,
  onClearAssignee,
  counts,
  secondary,
  onSecondary,
  showHints,
  currentUserId,
  onboardingComplete
}: SidebarProps) {
  const { t } = useDashTheme()
  const { open } = useContextMenu()
  const a = useTaskActions()
  const router = useRouter()
  const team = useTeam()
  const { open: openPortfolio } = usePortfolioSheet()
  // Self first; remaining members ordered by how reachable they look right
  // now (online > active today > away > on vacation > left).
  const orderedTeam = [
    ...team.filter((m) => m.id === currentUserId),
    ...team
      .filter((m) => m.id !== currentUserId)
      .sort((a, b) => {
        const dr = presenceRank(a) - presenceRank(b)
        if (dr !== 0) return dr
        return a.name.localeCompare(b.name)
      })
  ]

  const memberMenu = (
    e: React.MouseEvent,
    memberId: string,
    memberName: string
  ) => {
    const isActive = assigneeFilter.includes(memberId)
    open(e, [
      {
        id: 'profile',
        label: 'View profile',
        icon: <Users className="size-3.5" />,
        onSelect: () => openPortfolio(memberId)
      },
      {
        id: 'filter',
        label: isActive
          ? `Remove ${memberName} from filter`
          : `Add ${memberName} to filter`,
        icon: <Filter className="size-3.5" />,
        onSelect: () => a.toggleAssigneeFilter(memberId)
      },
      {
        id: 'clear-filter',
        label: 'Clear assignee filter',
        icon: <X className="size-3.5" />,
        disabled: assigneeFilter.length === 0,
        onSelect: () => a.clearAssigneeFilter()
      }
    ])
  }

  const statusMenu = (e: React.MouseEvent, s: TaskStatus, label: string) => {
    const isActive = statusFilter.includes(s)
    open(e, [
      {
        id: 'filter',
        label: isActive
          ? `Remove ${label} from filter`
          : `Add ${label} to filter`,
        icon: <Filter className="size-3.5" />,
        onSelect: () => onToggleStatus(s)
      },
      {
        id: 'clear-filter',
        label: 'Clear status filter',
        icon: <X className="size-3.5" />,
        disabled: statusFilter.length === 0,
        onSelect: () => onClearStatus()
      }
    ])
  }

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        data-tour="sidebar"
        className={`flex h-full min-w-0 scrollbar-none flex-col gap-5 overflow-y-auto border-r px-3 py-4 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${t.sidebar}`}
      >
        <Link
          href="/dashboard"
          className={`-mx-1 flex items-center gap-2 rounded-md px-2 py-1 transition ${t.rowHover}`}
          title="Back to all Tasks"
        >
          <Image
            src="/logos/logo-icon.png"
            alt="Verbivore"
            width={24}
            height={24}
            className="size-6 rounded"
            priority
          />
          <div className="flex flex-col leading-none">
            <span
              className={`text-[11px] tracking-[0.25em] uppercase ${t.textMuted}`}
            >
              Verbivore
            </span>
            <span className={`text-xs ${t.text}`}>Workspace</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-0.5">
          <SidebarItem
            icon={<LayoutGrid className="size-3.5" />}
            label="All Tasks"
            count={counts.all}
            active={secondary === 'all'}
            onClick={() => onView('all')}
            hint={showHints ? HINTS.all : undefined}
          />
          <SidebarItem
            icon={<Star className="size-3.5" />}
            label="My tasks"
            count={counts.mine}
            active={secondary === 'mine'}
            onClick={() => onView('mine')}
            hint={showHints ? HINTS.mine : undefined}
          />
          <SidebarItem
            icon={<Target className="size-3.5" />}
            label="Active"
            count={counts.inbox}
            active={secondary === 'inbox'}
            onClick={() => onView('inbox')}
            hint={showHints ? HINTS.inbox : undefined}
          />
          <SidebarItem
            icon={<AtSign className="size-3.5" />}
            label="Mentions"
            count={counts.mentions}
            active={secondary === 'mentions'}
            onClick={() => onView('mentions')}
            hint={showHints ? HINTS.mentions : undefined}
          />
          <SidebarItem
            icon={<ArchiveIcon className="size-3.5" />}
            label="Archive"
            active={secondary === 'archive'}
            onClick={() => onSecondary('archive')}
            hint={showHints ? HINTS.archive : undefined}
          />
        </nav>

        <div className="flex flex-col gap-1">
          <div
            className={`mb-1 px-2 text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
          >
            Status
          </div>
          <SidebarFilter
            active={statusFilter.length === 0}
            onClick={() => onClearStatus()}
          >
            <span
              className={`inline-block size-3.5 rounded-full ${
                statusFilter.length === 0 ? 'bg-zinc-400' : 'bg-zinc-300'
              }`}
            />
            Any
          </SidebarFilter>
          {STATUSES.map((s) => (
            <SidebarFilter
              key={s.id}
              active={statusFilter.includes(s.id)}
              onClick={() => onToggleStatus(s.id)}
              onContextMenu={(e) => statusMenu(e, s.id, s.label)}
            >
              <StatusIcon status={s.id} className="size-3.5" />
              {s.label}
            </SidebarFilter>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div
            className={`mb-1 flex items-center gap-2 px-2 text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
          >
            <Users className="size-3" /> Team
          </div>
          <SidebarFilter
            active={assigneeFilter.length === 0}
            onClick={() => onClearAssignee()}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                t.text
              } ${assigneeFilter.length === 0 ? 'bg-zinc-200' : 'bg-zinc-100'}`}
            >
              All
            </span>
            Everyone
          </SidebarFilter>
          {orderedTeam.map((m) => {
            const presence = getPresence(m)
            const isOut = presence === 'on_vacation' || presence === 'left'
            return (
              <SidebarFilter
                key={m.id}
                active={assigneeFilter.includes(m.id)}
                onClick={() => onToggleAssignee(m.id)}
                onContextMenu={(e) => memberMenu(e, m.id, m.name)}
              >
                <Avatar user={m} size={20} showPresence />
                <span
                  className={`truncate ${isOut ? 'opacity-50' : ''}`}
                  title={PRESENCE_LABEL[presence]}
                >
                  {m.name}
                </span>
                {isOut && (
                  <span
                    className={`ml-auto shrink-0 text-[9px] tracking-wide uppercase ${t.textSubtle}`}
                  >
                    {presence === 'left' ? 'Left' : 'PTO'}
                  </span>
                )}
              </SidebarFilter>
            )
          })}
        </div>

        <div className="mt-auto flex flex-col gap-0.5">
          <SidebarItem
            icon={<Folder className="size-3.5" />}
            label="Projects"
            active={secondary === 'projects'}
            onClick={() => onSecondary('projects')}
            hint={showHints ? HINTS.projects : undefined}
          />
          <SidebarItem
            icon={<Bell className="size-3.5" />}
            label="Updates"
            active={secondary === 'updates'}
            onClick={() => onSecondary('updates')}
            hint={showHints ? HINTS.updates : undefined}
          />
          <SidebarItem
            icon={<Shapes className="size-3.5" />}
            label="Symbols"
            active={secondary === 'symbols'}
            onClick={() => onSecondary('symbols')}
            hint={showHints ? HINTS.symbols : undefined}
          />
          <SidebarItem
            icon={<Settings className="size-3.5" />}
            label="Settings"
            active={secondary === 'settings'}
            onClick={() => onSecondary('settings')}
            hint={showHints ? HINTS.settings : undefined}
          />
        </div>

        {!onboardingComplete && (
          <div className={`mt-auto flex flex-col gap-0.5 border-t pt-3 ${t.border}`}>
            <SidebarItem
              icon={<UserCog className="size-3.5" />}
              label="Finish your profile"
              onClick={() => {
                window.location.href = '/onboarding'
              }}
              hint={
                showHints
                  ? 'Re-run the onboarding wizard. Already-filled steps offer Keep current to skip.'
                  : undefined
              }
            />
            <SidebarItem
              icon={<Compass className="size-3.5" />}
              label="Take a tour"
              onClick={() => startDashboardTour(router)}
              hint={
                showHints
                  ? 'A quick 5-step walkthrough of the dashboard.'
                  : undefined
              }
            />
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
  hint
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  onClick?: () => void
  hint?: string
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`group flex items-center rounded-md text-xs transition ${
        active ? t.btnActive : t.tab
      }`}
    >
      <button
        onClick={onClick}
        className="flex flex-1 items-center justify-between gap-2 px-2 py-1.5"
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
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              aria-label={`What is ${label}?`}
              tabIndex={0}
              className={`mr-1.5 flex size-4 cursor-help items-center justify-center rounded-full ${t.textSubtle} opacity-50 hover:opacity-100 focus:outline-none focus-visible:opacity-100`}
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="size-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            {hint}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
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
