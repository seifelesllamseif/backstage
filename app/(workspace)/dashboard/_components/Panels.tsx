'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  Bell,
  CalendarDays,
  Check,
  Compass,
  ExternalLink,
  FileText,
  Flag,
  GitBranch,
  GitCommit,
  GitPullRequest,
  LayoutGrid,
  Link as LinkIcon,
  List as ListIcon,
  MessageCircleQuestion,
  MessageSquare,
  Moon,
  MoreHorizontal,
  MoveRight,
  Paperclip,
  Pencil,
  Plus,
  Rabbit,
  Search,
  Sparkles,
  Sun,
  Table as TableIcon,
  UserCog,
  X
} from 'lucide-react'
import { BoardTask, BoardAssignee } from './boardData'
import Avatar from './Avatar'
import { startDashboardTour } from './DashboardTour'
import { usePushSubscription } from './usePushSubscription'
import { useInstallPrompt } from './useInstallPrompt'
import {
  disconnectGoogle,
  getGoogleConnectionStatus,
  getMyEmailPrefs,
  sendSelfTestPush,
  updateMyEmailPrefs
} from '../actions'
import {
  GithubIcon,
  FigmaIcon,
  SupabaseIcon,
  VerbivoreIcon,
  VercelIcon,
  SentryIcon,
  GoDaddyIcon,
  GoogleCloudIcon,
  GoogleDocsIcon,
  ResendIcon,
  StripeIcon,
  WordPressIcon
} from './BrandIcons'
import type { ProjectExternalRef, TaskExternalRefKind } from './boardData'
import { defaultExternalRefLabel, parseExternalRef } from '@/lib/externalRef'
import { CopyButton, type CopyMenuItem } from '@/components/ui/copy-button'
import { updatesToJson, updatesToMarkdown } from '@/lib/export/updates'
import { isInScope, type TimeScope } from '@/lib/export/timeRange'
import StatusIcon from './StatusIcon'
import { useDashTheme } from './theme'
import {
  archiveProjectInPlace,
  createProjectInPlace,
  renameProject,
  unarchiveProject
} from '../actions'
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

type ProjectKind = 'standard' | 'operations'

interface ProjectRow {
  id: string
  name: string
  kind: ProjectKind
  isArchived: boolean
  githubRepo: string | null
}

export function ProjectsPanel({
  tasks,
  projects,
  currentUserId,
  accessTier,
  allMembers,
  projectAssigneeIds,
  onOpenProject,
  refsByProject,
  onAddProjectRef,
  onRemoveProjectRef,
  onRenameProjectRef,
  renderCopySlot
}: {
  tasks: BoardTask[]
  projects: ProjectRow[]
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
  // Full company team. Looked up by id to resolve project rosters into
  // BoardAssignee objects.
  allMembers: BoardAssignee[]
  // Distinct assignee ids per project, computed server-side across all
  // tasks (not the viewer's visible slice). Drives the avatar stack on
  // each project card.
  projectAssigneeIds: Record<string, string[]>
  onOpenProject: (id: string) => void
  refsByProject: Record<string, ProjectExternalRef[]>
  onAddProjectRef: (projectId: string, url: string) => void
  onRemoveProjectRef: (projectId: string, refId: string) => void
  onRenameProjectRef: (
    projectId: string,
    refId: string,
    label: string | null
  ) => void
  // Optional per-project copy-button factory. DashboardShell owns the
  // export context so it injects a CopyButton per project here.
  renderCopySlot?: (projectId: string) => React.ReactNode
}) {
  const { t } = useDashTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const canEdit = accessTier === 'admin' || accessTier === 'lead'
  const [pending, startTransition] = useTransition()
  // After every project mutation: invalidate the React Query cache so
  // DashboardChrome refetches and the new initial flows down. router.refresh
  // alone doesn't help because data now lives in the client-side cache.
  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboardInitial'] })
    router.refresh()
  }
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = useState<ProjectRow | null>(null)
  const [view, setView] = useState<'grid' | 'table' | 'list'>('grid')

  // Group tasks by projectId so each card can show real progress for the
  // current member's visible task set. `tasks` is already filtered to
  // visibleTasks in DashboardShell, so members see only their own counts.
  const byProject = useMemo(() => {
    const map = new Map<string, BoardTask[]>()
    for (const task of tasks) {
      const pid = task.projectId
      if (!pid) continue
      const list = map.get(pid) ?? []
      list.push(task)
      map.set(pid, list)
    }
    return map
  }, [tasks])

  // Distinct assignees per project. Resolved from the server-provided
  // `projectAssigneeIds` map so every role (including members, whose
  // visible-task slice would otherwise show "just me") sees the real
  // team on each card. Sorted by name so avatar order is stable.
  const membersByProject = useMemo(() => {
    const byId = new Map(allMembers.map((m) => [m.id, m]))
    const map = new Map<string, BoardAssignee[]>()
    for (const project of projects) {
      const ids = projectAssigneeIds[project.id] ?? []
      const roster: BoardAssignee[] = []
      for (const id of ids) {
        const m = byId.get(id)
        if (m) roster.push(m)
      }
      roster.sort((a, b) => a.name.localeCompare(b.name))
      map.set(project.id, roster)
    }
    return map
  }, [projects, projectAssigneeIds, allMembers])

  // Members only see projects where they have at least one assigned task.
  const visibleProjects = canEdit
    ? projects
    : projects.filter((p) => {
        const list = byProject.get(p.id) ?? []
        return list.some((task) => task.assignee?.id === currentUserId)
      })
  const activeProjects = visibleProjects.filter((p) => !p.isArchived)
  const archivedProjects = canEdit
    ? visibleProjects.filter((p) => p.isArchived)
    : []

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createProjectInPlace(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Project created.')
      setShowNew(false)
      refreshDashboard()
    })
  }

  const handleRename = (projectId: string, name: string) => {
    const fd = new FormData()
    fd.set('projectId', projectId)
    fd.set('name', name)
    startTransition(async () => {
      const result = await renameProject(fd)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Project renamed.')
      setEditingId(null)
      refreshDashboard()
    })
  }

  const confirmArchive = () => {
    if (!pendingArchive) return
    const fd = new FormData()
    fd.set('projectId', pendingArchive.id)
    startTransition(async () => {
      const result = await archiveProjectInPlace(fd)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Project archived.')
      setPendingArchive(null)
      refreshDashboard()
    })
  }

  const handleRestore = (projectId: string) => {
    const fd = new FormData()
    fd.set('projectId', projectId)
    startTransition(async () => {
      const result = await unarchiveProject(fd)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Project restored.')
      refreshDashboard()
    })
  }

  const renderCard = (project: ProjectRow) => {
    const list = byProject.get(project.id) ?? []
    const done = list.filter((x) => x.status === 'done').length
    const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100)
    const members = membersByProject.get(project.id) ?? []
    return (
      <ProjectCard
        key={project.id}
        project={project}
        tasks={list}
        refs={sortRefsByImportance(refsByProject[project.id] ?? [])}
        members={members}
        done={done}
        pct={pct}
        canEdit={canEdit}
        isEditing={editingId === project.id}
        onStartEdit={() => setEditingId(project.id)}
        onCancelEdit={() => setEditingId(null)}
        onRename={(name) => handleRename(project.id, name)}
        onArchive={() => setPendingArchive(project)}
        onRestore={() => handleRestore(project.id)}
        onOpen={() => onOpenProject(project.id)}
        onAddRef={(url) => onAddProjectRef(project.id, url)}
        onRemoveRef={(refId) => onRemoveProjectRef(project.id, refId)}
        onRenameRef={(refId, label) =>
          onRenameProjectRef(project.id, refId, label)
        }
        copySlot={renderCopySlot?.(project.id)}
        disabled={pending}
      />
    )
  }

  const renderProjects = (list: ProjectRow[]) => {
    if (view === 'table') {
      return (
        <ProjectTable
          projects={list}
          byProject={byProject}
          membersByProject={membersByProject}
          refsByProject={refsByProject}
          canEdit={canEdit}
          onOpen={onOpenProject}
          onArchiveTrigger={setPendingArchive}
          onRestore={handleRestore}
        />
      )
    }
    if (view === 'list') {
      return (
        <ProjectList
          projects={list}
          byProject={byProject}
          membersByProject={membersByProject}
          refsByProject={refsByProject}
          onOpen={onOpenProject}
        />
      )
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map(renderCard)}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={`text-lg font-medium ${t.text}`}>Projects</h2>
            <p className={`text-xs ${t.textMuted}`}>
              {canEdit
                ? `${activeProjects.length} active${
                    archivedProjects.length > 0
                      ? ` · ${archivedProjects.length} archived`
                      : ''
                  }`
                : `${activeProjects.length} you're working on`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewSwitcher value={view} onChange={setView} />
            {canEdit && !showNew && (
              <button
                onClick={() => setShowNew(true)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
              >
                <Plus className="size-3.5" /> New project
              </button>
            )}
          </div>
        </header>

        {canEdit && showNew && (
          <NewProjectForm
            onSubmit={handleCreate}
            onCancel={() => setShowNew(false)}
            disabled={pending}
          />
        )}

        <AlertDialog
          open={pendingArchive !== null}
          onOpenChange={(open) => {
            if (!open && !pending) setPendingArchive(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this project?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingArchive
                  ? `"${pendingArchive.name}" will move to the Archived section below. Its tasks and history stay intact and you can restore it from there.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault()
                  confirmArchive()
                }}
              >
                {pending ? 'Archiving…' : 'Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeProjects.length === 0 ? (
          <EmptyState canEdit={canEdit} />
        ) : (
          renderProjects(activeProjects)
        )}

        {archivedProjects.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h3
                className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
              >
                Archived
              </h3>
              <span className={`text-[10px] ${t.textSubtle}`}>
                Hidden from pickers · restore to use again
              </span>
            </div>
            {renderProjects(archivedProjects)}
          </section>
        )}
      </div>
    </div>
  )
}

function NewProjectForm({
  onSubmit,
  onCancel,
  disabled
}: {
  onSubmit: (fd: FormData) => void
  onCancel: () => void
  disabled: boolean
}) {
  const { t } = useDashTheme()
  return (
    <form
      action={onSubmit}
      className={`flex flex-col gap-3 rounded-xl border p-4 ${t.column}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium tracking-wider uppercase ${t.textMuted}`}
        >
          New project
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={`size-6 rounded ${t.btn} flex items-center justify-center`}
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoFocus
          placeholder="Project name"
          className={`h-9 rounded-md border px-3 text-sm ${t.input}`}
        />
        <select
          name="kind"
          defaultValue="standard"
          className={`h-9 rounded-md border px-2 text-xs ${t.input}`}
        >
          <option value="standard">Standard</option>
          <option value="operations">Operations</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={`h-8 rounded-md px-3 text-xs ${t.accent}`}
          disabled={disabled}
        >
          {disabled ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function ProjectCard({
  project,
  tasks,
  refs,
  members,
  done,
  pct,
  canEdit,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onRename,
  onArchive,
  onRestore,
  onOpen,
  onAddRef,
  onRemoveRef,
  onRenameRef,
  copySlot,
  disabled
}: {
  project: ProjectRow
  tasks: BoardTask[]
  refs: ProjectExternalRef[]
  members: BoardAssignee[]
  done: number
  pct: number
  canEdit: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onRename: (name: string) => void
  onArchive: () => void
  onRestore: () => void
  onOpen: () => void
  onAddRef: (url: string) => void
  onRemoveRef: (refId: string) => void
  onRenameRef: (refId: string, label: string | null) => void
  copySlot?: React.ReactNode
  disabled: boolean
}) {
  const { t } = useDashTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)

  // Archived projects can be opened (we still want their boards reachable)
  // but render dimmed so the active set reads as the primary surface.
  const cardClickable = !isEditing
  const handleCardClick = () => {
    if (cardClickable) onOpen()
  }
  const handleCardKey = (e: React.KeyboardEvent) => {
    if (!cardClickable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }
  const stop = (e: React.MouseEvent | React.KeyboardEvent) =>
    e.stopPropagation()

  // Visual tier for the kind chip. Operations is the standing lane (per
  // lib/business-logic.ts) so it gets an amber tint to match the lead
  // role badge; standard projects stay neutral.
  const kindClasses =
    project.kind === 'operations'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : t.metaTag
  const hasFooter = canEdit || refs.length > 0

  return (
    <div
      role={cardClickable ? 'button' : undefined}
      tabIndex={cardClickable ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      aria-label={cardClickable ? `Open ${project.name}` : undefined}
      className={`group relative flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-150 ${t.column} ${
        cardClickable
          ? 'cursor-pointer hover:-translate-y-px hover:border-zinc-300 hover:shadow-sm dark:hover:border-white/20'
          : ''
      } ${project.isArchived ? 'opacity-70' : ''}`}
    >
      {/* Verbivore watermark. Sits behind everything via a clipped overflow
          wrapper so the dropdown menu and rounded corners are unaffected.
          Subtle by default, lifts on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"
      >
        <img
          src="/logos/verbivore-icon.svg"
          alt=""
          className="absolute -right-4 -bottom-6 size-32 opacity-[0.04] transition-opacity duration-200 group-hover:opacity-[0.1] dark:invert"
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (renameValue.trim().length >= 2) onRename(renameValue.trim())
              }}
              onClick={stop}
              className="flex items-center gap-1"
            >
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onClick={stop}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setRenameValue(project.name)
                    onCancelEdit()
                  }
                }}
                className={`h-8 w-full rounded-md border px-2 text-sm ${t.input}`}
              />
              <button
                type="submit"
                disabled={disabled}
                onClick={stop}
                className={`h-8 rounded-md px-2.5 text-[11px] ${t.accent}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  setRenameValue(project.name)
                  onCancelEdit()
                }}
                className={`h-8 rounded-md border px-2.5 text-[11px] ${t.btn}`}
              >
                Cancel
              </button>
            </form>
          ) : (
            <h3
              className={`truncate text-[15px] leading-tight font-semibold tracking-tight ${t.text}`}
            >
              {project.name}
            </h3>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase ${kindClasses}`}
            >
              {project.kind}
            </span>
            {project.isArchived && (
              <span
                className={`inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
              >
                <ArchiveIcon className="size-2.5" /> Archived
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5" onClick={stop}>
          {copySlot}
          {canEdit && !isEditing && (
            <div className="relative">
              <button
                onClick={(e) => {
                  stop(e)
                  setMenuOpen((o) => !o)
                }}
                className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
                aria-label="Project actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      stop(e)
                      setMenuOpen(false)
                    }}
                  />
                  <div
                    className={`absolute top-8 right-0 z-40 w-40 rounded-md border py-1 shadow-xl ${t.detail}`}
                    onClick={stop}
                  >
                    <button
                      onClick={(e) => {
                        stop(e)
                        setMenuOpen(false)
                        onStartEdit()
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab}`}
                    >
                      <Pencil className="size-3.5" /> Rename
                    </button>
                    {project.isArchived ? (
                      <button
                        onClick={(e) => {
                          stop(e)
                          setMenuOpen(false)
                          onRestore()
                        }}
                        disabled={disabled}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs disabled:opacity-50 ${t.tab}`}
                      >
                        <ArchiveRestore className="size-3.5" /> Restore
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          stop(e)
                          setMenuOpen(false)
                          onArchive()
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab} ${t.accentText}`}
                      >
                        <ArchiveIcon className="size-3.5" /> Archive
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div
          className={`rounded-lg border border-dashed px-3 py-2.5 text-center text-[11px] ${t.border} ${t.textMuted}`}
        >
          No tasks yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-2xl font-semibold tabular-nums ${t.text}`}>
              {pct}%
            </span>
            <span className={`text-[11px] tabular-nums ${t.textMuted}`}>
              {done} of {tasks.length} done
            </span>
          </div>
          <div className={`h-2 overflow-hidden rounded-full ${t.surfaceMuted}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex items-center gap-2.5">
          <MemberStack members={members} max={5} size={22} />
          <span
            className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
          >
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tasks.slice(0, 3).map((task) => (
            <li
              key={task.id}
              className={`flex items-center gap-2 text-xs ${t.textMuted}`}
            >
              <StatusIcon status={task.status} className="size-3 shrink-0" />
              <span className="truncate">{task.title}</span>
            </li>
          ))}
          {tasks.length > 3 && (
            <li className={`text-[10px] ${t.textSubtle}`}>
              +{tasks.length - 3} more task{tasks.length - 3 === 1 ? '' : 's'}
            </li>
          )}
        </ul>
      )}

      {hasFooter && (
        <div
          className={`-mx-5 mt-auto flex flex-col gap-2 border-t px-5 pt-3 ${t.border}`}
        >
          <ProjectLinksField
            refs={refs}
            onAdd={onAddRef}
            onRemove={onRemoveRef}
            onRename={onRenameRef}
            stop={stop}
          />
        </div>
      )}
    </div>
  )
}

function ViewSwitcher({
  value,
  onChange
}: {
  value: 'grid' | 'table' | 'list'
  onChange: (v: 'grid' | 'table' | 'list') => void
}) {
  const { t } = useDashTheme()
  const options: {
    id: 'grid' | 'table' | 'list'
    Icon: typeof LayoutGrid
    label: string
  }[] = [
    { id: 'grid', Icon: LayoutGrid, label: 'Grid' },
    { id: 'table', Icon: TableIcon, label: 'Table' },
    { id: 'list', Icon: ListIcon, label: 'List' }
  ]
  return (
    <div
      className={`flex items-center gap-0.5 rounded-md border p-0.5 ${t.border}`}
    >
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={`${opt.label} view`}
            className={`flex size-7 items-center justify-center rounded transition ${
              active ? t.tabActive : t.tab
            }`}
          >
            <opt.Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}

function MemberStack({
  members,
  max = 4,
  size = 20
}: {
  members: BoardAssignee[]
  max?: number
  size?: number
}) {
  const { t } = useDashTheme()
  const shown = members.slice(0, max)
  const extra = Math.max(0, members.length - shown.length)
  const overlap = Math.round(size / 2.8)
  // Ring needs the wrapper to be a block-level element so the box-shadow
  // renders as a clean halo (rings on inline spans clip or vanish in some
  // browsers). Hence inline-flex on each chip below.
  return (
    <div
      className="flex items-center"
      title={members.map((m) => m.name).join(', ')}
    >
      {shown.map((m, i) => (
        <div
          key={m.id}
          className="inline-flex rounded-full ring-2 ring-white dark:ring-zinc-900"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -overlap
          }}
        >
          <Avatar user={m} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className={`inline-flex items-center justify-center rounded-full text-[10px] font-medium ring-2 ring-white dark:ring-zinc-900 ${t.surfaceMuted} ${t.textMuted}`}
          style={{
            width: size,
            height: size,
            marginLeft: -overlap
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function ProjectTable({
  projects,
  byProject,
  membersByProject,
  refsByProject,
  canEdit,
  onOpen,
  onArchiveTrigger,
  onRestore
}: {
  projects: ProjectRow[]
  byProject: Map<string, BoardTask[]>
  membersByProject: Map<string, BoardAssignee[]>
  refsByProject: Record<string, ProjectExternalRef[]>
  canEdit: boolean
  onOpen: (id: string) => void
  onArchiveTrigger: (project: ProjectRow) => void
  onRestore: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <div className={`overflow-hidden rounded-xl border ${t.border}`}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr
            className={`${t.surfaceMuted} ${t.textMuted} text-[10px] tracking-wider uppercase`}
          >
            <th className="px-3 py-2 text-left font-medium">Project</th>
            <th className="hidden px-3 py-2 text-left font-medium md:table-cell">
              Kind
            </th>
            <th className="px-3 py-2 text-right font-medium">Tasks</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
              Done
            </th>
            <th className="px-3 py-2 text-left font-medium">Progress</th>
            <th className="hidden px-3 py-2 text-left font-medium md:table-cell">
              Members
            </th>
            <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">
              Links
            </th>
            {canEdit && (
              <th className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const tasks = byProject.get(project.id) ?? []
            const done = tasks.filter((x) => x.status === 'done').length
            const pct =
              tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
            const members = membersByProject.get(project.id) ?? []
            const refs = sortRefsByImportance(refsByProject[project.id] ?? [])
            return (
              <tr
                key={project.id}
                onClick={() => onOpen(project.id)}
                className={`cursor-pointer border-t transition ${t.border} hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                  project.isArchived ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`truncate font-medium ${t.text}`}>
                      {project.name}
                    </span>
                    {project.isArchived && (
                      <ArchiveIcon
                        className={`size-3 shrink-0 ${t.textSubtle}`}
                      />
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
                  >
                    {project.kind}
                  </span>
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums ${t.textMuted}`}
                >
                  {tasks.length}
                </td>
                <td
                  className={`hidden px-3 py-2.5 text-right tabular-nums sm:table-cell ${t.textMuted}`}
                >
                  {done}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-1.5 w-20 overflow-hidden rounded-full ${t.surfaceMuted}`}
                    >
                      <div
                        className="h-full bg-teal-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] tabular-nums ${t.textSubtle}`}
                    >
                      {pct}%
                    </span>
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  {members.length > 0 ? (
                    <MemberStack members={members} max={4} size={20} />
                  ) : (
                    <span className={`text-[10px] ${t.textSubtle}`}>None</span>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  {refs.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {refs.slice(0, 4).map((r) => {
                        const brand = displayBrand(r)
                        const Icon = refIconForKind(brand)
                        const palette = refChipPalette(brand, t.surfaceMuted)
                        const parsed = parseExternalRef(r.url)
                        const tipLabel =
                          r.label ??
                          (parsed ? defaultExternalRefLabel(parsed) : r.url)
                        return (
                          <a
                            key={r.id}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            title={tipLabel}
                            className={`flex size-5 items-center justify-center rounded border ${palette.wrapper}`}
                          >
                            <Icon className={`size-2.5 ${palette.icon}`} />
                          </a>
                        )
                      })}
                      {refs.length > 4 && (
                        <span className={`text-[10px] ${t.textSubtle}`}>
                          +{refs.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className={`text-[10px] ${t.textSubtle}`}>—</span>
                  )}
                </td>
                {canEdit && (
                  <td
                    className="px-3 py-2.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.isArchived ? (
                      <button
                        onClick={() => onRestore(project.id)}
                        className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] ${t.btn}`}
                      >
                        <ArchiveRestore className="size-3" /> Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => onArchiveTrigger(project)}
                        className={`inline-flex h-6 items-center gap-1 rounded px-2 text-[10px] ${t.btn}`}
                      >
                        <ArchiveIcon className="size-3" /> Archive
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProjectList({
  projects,
  byProject,
  membersByProject,
  refsByProject,
  onOpen
}: {
  projects: ProjectRow[]
  byProject: Map<string, BoardTask[]>
  membersByProject: Map<string, BoardAssignee[]>
  refsByProject: Record<string, ProjectExternalRef[]>
  onOpen: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <ul className={`flex flex-col rounded-xl border ${t.border}`}>
      {projects.map((project, idx) => {
        const tasks = byProject.get(project.id) ?? []
        const done = tasks.filter((x) => x.status === 'done').length
        const pct =
          tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
        const members = membersByProject.get(project.id) ?? []
        const refs = sortRefsByImportance(refsByProject[project.id] ?? [])
        // Brand badges in the compact list. Keep only the linkable-brand
        // surfaces so a project doc / plain link doesn't add visual noise.
        // Detection uses displayBrand so URL-derived brands (Resend,
        // GoDaddy) show up even though they're stored as kind='link'.
        const brandRefs = refs.filter((r) =>
          [
            'github',
            'supabase',
            'vercel',
            'gcloud',
            'stripe',
            'bunny',
            'sentry',
            'figma',
            'verbivore',
            'resend',
            'godaddy',
            'wordpress'
          ].includes(displayBrand(r))
        )
        return (
          <li
            key={project.id}
            onClick={() => onOpen(project.id)}
            className={`flex cursor-pointer items-center gap-4 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
              idx > 0 ? `border-t ${t.border}` : ''
            } ${project.isArchived ? 'opacity-60' : ''}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={`truncate text-sm font-medium ${t.text}`}>
                {project.name}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
              >
                {project.kind}
              </span>
              {brandRefs.slice(0, 4).map((r) => {
                const brand = displayBrand(r)
                const Icon = refIconForKind(brand)
                const palette = refChipPalette(brand, t.surfaceMuted)
                const parsed = parseExternalRef(r.url)
                const tipLabel =
                  r.label ?? (parsed ? defaultExternalRefLabel(parsed) : r.url)
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    title={tipLabel}
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded border ${palette.wrapper}`}
                  >
                    <Icon className={`size-2.5 ${palette.icon}`} />
                  </a>
                )
              })}
              {project.isArchived && (
                <ArchiveIcon className={`size-3 shrink-0 ${t.textSubtle}`} />
              )}
            </div>
            <span
              className={`hidden text-xs tabular-nums sm:inline ${t.textMuted}`}
            >
              {tasks.length === 0 ? 'No tasks' : `${done}/${tasks.length}`}
            </span>
            <div className="hidden w-32 items-center gap-2 md:flex">
              <div
                className={`h-1.5 flex-1 overflow-hidden rounded-full ${t.surfaceMuted}`}
              >
                <div
                  className="h-full bg-teal-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`w-8 text-right text-[10px] tabular-nums ${t.textSubtle}`}
              >
                {pct}%
              </span>
            </div>
            {members.length > 0 && (
              <MemberStack members={members} max={4} size={20} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Virtual display brand: DB-stored kinds plus URL-derived sub-brands
// (Google Docs, Resend, GoDaddy, WordPress). The DB column stays
// `external_ref_kind`; this is render-time only so no migration is needed.
type DisplayBrand =
  | TaskExternalRefKind
  | 'gdocs'
  | 'resend'
  | 'godaddy'
  | 'wordpress'

function displayBrand(ref: {
  kind: TaskExternalRefKind
  url: string
}): DisplayBrand {
  let host = ''
  let pathname = ''
  try {
    const u = new URL(ref.url)
    host = u.hostname.toLowerCase().replace(/^www\./, '')
    pathname = u.pathname.toLowerCase()
  } catch {
    return ref.kind
  }
  if (ref.kind === 'doc' && host === 'docs.google.com') return 'gdocs'
  if (ref.kind === 'link') {
    if (host === 'resend.com' || host.endsWith('.resend.com')) return 'resend'
    if (host === 'godaddy.com' || host.endsWith('.godaddy.com'))
      return 'godaddy'
    // WordPress: hosted variants AND custom-domain self-hosts (detected
    // via the canonical /wp-admin or /wp-content/ paths).
    if (
      host === 'wordpress.com' ||
      host.endsWith('.wordpress.com') ||
      host.endsWith('.wp.com') ||
      pathname.startsWith('/wp-admin') ||
      pathname.includes('/wp-content/') ||
      pathname === '/wp-login.php'
    ) {
      return 'wordpress'
    }
  }
  return ref.kind
}

function refIconForKind(kind: DisplayBrand) {
  switch (kind) {
    case 'pr':
      return GitPullRequest
    case 'issue':
      return MessageCircleQuestion
    case 'commit':
      return GitCommit
    case 'doc':
      return FileText
    case 'gdocs':
      return GoogleDocsIcon
    case 'resend':
      return ResendIcon
    case 'godaddy':
      return GoDaddyIcon
    case 'wordpress':
      return WordPressIcon
    case 'supabase':
      return SupabaseIcon
    case 'github':
      return GithubIcon
    case 'figma':
      return FigmaIcon
    case 'verbivore':
      return VerbivoreIcon
    case 'vercel':
      return VercelIcon
    case 'bunny':
      return Rabbit
    case 'sentry':
      return SentryIcon
    case 'gcloud':
      return GoogleCloudIcon
    case 'stripe':
      return StripeIcon
    case 'link':
    default:
      return LinkIcon
  }
}

// Brand-aware chip color. Used by the Links list on the project card so
// each external ref reads like the service it points at (Supabase green,
// Figma red-ish gradient, GitHub neutral but darker than a plain link).
function refChipPalette(
  kind: DisplayBrand,
  fallback: string
): { wrapper: string; icon: string } {
  switch (kind) {
    case 'gdocs':
      return {
        wrapper: 'border-blue-500/40 bg-blue-500/5',
        icon: ''
      }
    case 'resend':
      return {
        // Resend's brand is near-black, high-contrast tile.
        wrapper: 'border-zinc-400/40 bg-zinc-500/5',
        icon: 'text-zinc-900 dark:text-zinc-100'
      }
    case 'godaddy':
      return {
        // GoDaddy heart paints in their signature teal.
        wrapper: 'border-teal-500/40 bg-teal-500/5',
        icon: 'text-teal-500'
      }
    case 'wordpress':
      return {
        // WordPress brand blue (#21759B). Closest Tailwind hue is sky.
        wrapper: 'border-sky-500/40 bg-sky-500/5',
        icon: 'text-sky-600 dark:text-sky-400'
      }
    case 'supabase':
      return {
        wrapper: 'border-emerald-500/40 bg-emerald-500/5',
        icon: 'text-emerald-500'
      }
    case 'github':
      return {
        wrapper: 'border-zinc-400/40 bg-zinc-500/5',
        icon: 'text-zinc-900 dark:text-zinc-100'
      }
    case 'figma':
      return {
        // Figma icon is multi-color in the SVG itself - the wrapper just
        // gives it a pink/violet tint so the row reads as branded.
        wrapper: 'border-pink-500/40 bg-pink-500/5',
        icon: ''
      }
    case 'verbivore':
      return {
        // Verbivore mark is the company's own brand - light gold tint, no
        // colour override on the icon since the SVG carries its own.
        wrapper: 'border-amber-400/40 bg-amber-400/5',
        icon: ''
      }
    case 'vercel':
      return {
        // Vercel's mark is the classic black triangle; high-contrast tile.
        wrapper: 'border-zinc-400/40 bg-zinc-500/5',
        icon: 'text-zinc-900 dark:text-zinc-100'
      }
    case 'bunny':
      return {
        // Bunny's brand is orange. Rabbit icon is line-art so it tints
        // cleanly via currentColor.
        wrapper: 'border-orange-500/40 bg-orange-500/5',
        icon: 'text-orange-500'
      }
    case 'sentry':
      return {
        // Sentry's brand purple.
        wrapper: 'border-purple-500/40 bg-purple-500/5',
        icon: 'text-purple-600 dark:text-purple-400'
      }
    case 'gcloud':
      return {
        // Google Cloud icon is multi-colour in the SVG itself; wrapper is
        // a neutral Google-blue-ish tint.
        wrapper: 'border-blue-500/30 bg-blue-500/5',
        icon: ''
      }
    case 'stripe':
      return {
        // Stripe's "blurple" - indigo/violet sits closest in Tailwind.
        wrapper: 'border-indigo-500/40 bg-indigo-500/5',
        icon: 'text-indigo-500'
      }
    default:
      return { wrapper: fallback, icon: 'text-zinc-500' }
  }
}

// Display ordering for ref chips. GitHub goes first since members hit it
// most often (code / PRs / issues), then the data + infra surfaces, then
// design, then the brand's own properties, then generic sub-kinds. Any
// kind not listed falls to the end.
const REF_KIND_ORDER: TaskExternalRefKind[] = [
  'github',
  'pr',
  'issue',
  'commit',
  'supabase',
  'vercel',
  'gcloud',
  'stripe',
  'bunny',
  'sentry',
  'figma',
  'verbivore',
  'doc',
  'link'
]

function refRank(kind: TaskExternalRefKind): number {
  const i = REF_KIND_ORDER.indexOf(kind)
  return i === -1 ? REF_KIND_ORDER.length : i
}

function sortRefsByImportance<T extends { kind: TaskExternalRefKind }>(
  refs: T[]
): T[] {
  return [...refs].sort((a, b) => refRank(a.kind) - refRank(b.kind))
}

function LinkRow({
  refData,
  onRemove,
  onRename,
  stop
}: {
  refData: ProjectExternalRef
  onRemove: (refId: string) => void
  onRename: (refId: string, label: string | null) => void
  stop: (e: React.MouseEvent | React.KeyboardEvent) => void
}) {
  const { t } = useDashTheme()
  const parsed = parseExternalRef(refData.url)
  const fallbackLabel = parsed ? defaultExternalRefLabel(parsed) : refData.url
  const displayLabel = refData.label ?? fallbackLabel
  const brand = displayBrand(refData)
  const Icon = refIconForKind(brand)
  const palette = refChipPalette(brand, t.surfaceMuted)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(refData.label ?? '')

  const startEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    stop(e)
    setDraft(refData.label ?? '')
    setEditing(true)
  }

  const commit = () => {
    const next = draft.trim()
    const normalized = next.length === 0 ? null : next
    if (normalized !== refData.label) onRename(refData.id, normalized)
    setEditing(false)
  }

  return (
    <li
      className={`group flex items-center gap-2 rounded-md border px-2 py-1 ${palette.wrapper}`}
    >
      <Icon className={`size-3 shrink-0 ${palette.icon}`} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
            }
          }}
          onClick={stop}
          placeholder={fallbackLabel}
          className={`h-5 min-w-0 flex-1 rounded border-0 bg-transparent text-[11px] outline-none ${t.text}`}
        />
      ) : (
        <a
          href={refData.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={stop}
          className={`flex min-w-0 flex-1 items-center gap-1 text-[11px] ${t.text}`}
          title={refData.url}
        >
          <span className="truncate">{displayLabel}</span>
          <ExternalLink className={`size-2.5 shrink-0 ${t.textSubtle}`} />
        </a>
      )}
      {!editing && (
        <button
          onClick={startEdit}
          className={`flex size-4 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
          aria-label="Rename link"
        >
          <Pencil className="size-2.5" />
        </button>
      )}
      <button
        onClick={() => onRemove(refData.id)}
        className={`flex size-4 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
        aria-label="Remove link"
      >
        <X className="size-2.5" />
      </button>
    </li>
  )
}

function ProjectLinksField({
  refs,
  onAdd,
  onRemove,
  onRename,
  stop
}: {
  refs: ProjectExternalRef[]
  onAdd: (url: string) => void
  onRemove: (refId: string) => void
  onRename: (refId: string, label: string | null) => void
  stop: (e: React.MouseEvent | React.KeyboardEvent) => void
}) {
  const { t } = useDashTheme()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const parsed = parseExternalRef(trimmed)
    if (!parsed) {
      setErr('Not a valid URL.')
      return
    }
    onAdd(parsed.url)
    setUrl('')
    setErr(null)
    setAdding(false)
  }

  if (refs.length === 0 && !adding) {
    return (
      <button
        onClick={(e) => {
          stop(e)
          setAdding(true)
        }}
        className={`flex items-center gap-1.5 self-start text-[11px] ${t.textSubtle} hover:${t.text}`}
      >
        <LinkIcon className="size-3" /> Add doc or link
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5" onClick={stop}>
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] tracking-[0.22em] uppercase ${t.textMuted}`}
        >
          Links
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className={`flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
          >
            <Plus className="size-2.5" /> Add
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {refs.map((ref) => (
          <LinkRow
            key={ref.id}
            refData={ref}
            onRemove={onRemove}
            onRename={onRename}
            stop={stop}
          />
        ))}
      </ul>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (err) setErr(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setUrl('')
                setErr(null)
                setAdding(false)
              }
            }}
            placeholder="Paste a Google Doc, Notion, PR, or any URL…"
            className={`h-7 flex-1 rounded-md border px-2 text-[11px] ${t.input}`}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className={`flex h-7 items-center justify-center rounded-md px-2 disabled:opacity-50 ${t.accent}`}
          >
            <Check className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUrl('')
              setErr(null)
              setAdding(false)
            }}
            className={`flex size-7 items-center justify-center rounded-md border ${t.btn}`}
          >
            <X className="size-3" />
          </button>
        </form>
      )}
      {err && <p className="text-[10px] text-red-500">{err}</p>}
    </div>
  )
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center ${t.border}`}
    >
      <p className={`text-sm ${t.text}`}>
        {canEdit ? 'No projects yet' : 'No projects assigned to you yet'}
      </p>
      <p className={`max-w-sm text-xs ${t.textMuted}`}>
        {canEdit
          ? 'Click "New project" above to create the first one.'
          : 'When a task is assigned to you, the project it belongs to will show up here.'}
      </p>
    </div>
  )
}

type UpdateKind =
  | 'status'
  | 'comment'
  | 'attachment'
  | 'created'
  | 'priority'
  | 'assignee'
  | 'team'
  | 'meeting'

interface UpdateRow {
  id: string
  kind: UpdateKind
  text: string
  at: string
  atRaw: string
  // taskId is nullable now because team-management rows don't tie to
  // a task. The renderer hides the "jump to task" affordance when null.
  taskId: string | null
  taskRef: string | null
  taskTitle: string | null
  // Populated for meeting rows; click opens the inbox sheet focused on
  // this meeting. Null for everything else.
  meetingId: string | null
  // Activity-log action string for meeting rows ("meeting.reviewed",
  // "meeting.requested", ...). Drives where the click routes: reviewed
  // meetings open the share page (which has the recap), everything
  // else falls back to the inbox sheet.
  meetingAction?: string | null
}

type UpdateFilter =
  | 'all'
  | 'comment'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'team'
  | 'meeting'

const FILTERS: { id: UpdateFilter; label: string; match: UpdateKind[] }[] = [
  { id: 'all', label: 'All', match: [] },
  { id: 'comment', label: 'Comments', match: ['comment'] },
  { id: 'status', label: 'Status', match: ['status', 'created'] },
  { id: 'priority', label: 'Priority', match: ['priority'] },
  { id: 'assignee', label: 'Assignees', match: ['assignee'] },
  { id: 'team', label: 'Team', match: ['team'] },
  { id: 'meeting', label: 'Meetings', match: ['meeting'] }
]

function kindIcon(kind: UpdateKind) {
  switch (kind) {
    case 'comment':
      return MessageSquare
    case 'priority':
      return Flag
    case 'assignee':
      return UserCog
    case 'attachment':
      return Paperclip
    case 'created':
      return Sparkles
    case 'team':
      return UserCog
    case 'meeting':
      return CalendarDays
    case 'status':
    default:
      return MoveRight
  }
}

function kindTone(kind: UpdateKind, mode: 'light' | 'dark') {
  if (mode === 'light') {
    switch (kind) {
      case 'comment':
        return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'priority':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'assignee':
        return 'bg-violet-100 text-violet-700 border-violet-200'
      case 'attachment':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200'
      case 'created':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'team':
        return 'bg-teal-100 text-teal-700 border-teal-200'
      case 'meeting':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'status':
      default:
        return 'bg-rose-100 text-rose-700 border-rose-200'
    }
  }
  switch (kind) {
    case 'comment':
      return 'bg-sky-400/10 text-sky-300 border-sky-400/30'
    case 'priority':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/30'
    case 'assignee':
      return 'bg-violet-400/10 text-violet-300 border-violet-400/30'
    case 'attachment':
      return 'bg-white/5 text-white/70 border-white/20'
    case 'created':
      return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
    case 'team':
      return 'bg-teal-400/10 text-teal-300 border-teal-400/30'
    case 'meeting':
      return 'bg-indigo-400/10 text-indigo-300 border-indigo-400/30'
    case 'status':
    default:
      return 'bg-rose-400/10 text-rose-300 border-rose-400/30'
  }
}

function bucketFor(
  iso: string,
  now: Date
): 'today' | 'yesterday' | 'week' | 'earlier' {
  const d = new Date(iso)
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const today = startOfDay(now)
  const day = startOfDay(d)
  const diffDays = Math.round((today - day) / 86400000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays <= 6) return 'week'
  return 'earlier'
}

const BUCKETS: {
  id: 'today' | 'yesterday' | 'week' | 'earlier'
  label: string
}[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'earlier', label: 'Earlier' }
]

function scopedUpdates(
  rows: UpdateRow[],
  scope: Exclude<TimeScope, 'all' | 'sprint'>
): UpdateRow[] {
  const now = new Date()
  return rows.filter((row) => isInScope(row.atRaw, scope, now))
}

function buildUpdatesCopyMenu(args: {
  allActivity: UpdateRow[]
  filteredActivity: UpdateRow[]
  filterLabel?: string
}): CopyMenuItem[] {
  const meta = (label?: string) => ({
    title: 'Updates',
    scopeLabel: label
  })
  return [
    {
      id: 'md-current',
      label: 'Copy as Markdown',
      description: 'Honors current filter + search',
      getContent: () =>
        updatesToMarkdown(args.filteredActivity, meta(args.filterLabel)),
      toastLabel: 'updates as Markdown'
    },
    {
      id: 'json-current',
      label: 'Copy as JSON',
      description: 'Versioned shape for agent ingestion',
      getContent: () =>
        updatesToJson(args.filteredActivity, meta(args.filterLabel)),
      toastLabel: 'updates as JSON'
    },
    {
      id: 'today',
      label: 'Copy today (Markdown)',
      description: 'Updates since midnight',
      separatorBefore: true,
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'today'),
          meta('today')
        ),
      toastLabel: "today's updates"
    },
    {
      id: 'week',
      label: 'Copy this week (Markdown)',
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'week'),
          meta('this week')
        ),
      toastLabel: "this week's updates"
    },
    {
      id: 'month',
      label: 'Copy this month (Markdown)',
      getContent: () =>
        updatesToMarkdown(
          scopedUpdates(args.allActivity, 'month'),
          meta('this month')
        ),
      toastLabel: "this month's updates"
    },
    {
      id: 'all',
      label: 'Copy all (Markdown)',
      getContent: () => updatesToMarkdown(args.allActivity, meta('all')),
      toastLabel: 'all updates'
    }
  ]
}

export function UpdatesPanel({
  activity,
  onOpenTask,
  onOpenMeeting
}: {
  activity: UpdateRow[]
  onOpenTask: (taskId: string) => void
  onOpenMeeting: (meetingId: string) => void
}) {
  const { t, mode } = useDashTheme()
  const [filter, setFilter] = useState<UpdateFilter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<UpdateFilter, number> = {
      all: activity.length,
      comment: 0,
      status: 0,
      priority: 0,
      assignee: 0,
      team: 0,
      meeting: 0
    }
    for (const a of activity) {
      if (a.kind === 'comment') c.comment++
      else if (a.kind === 'status' || a.kind === 'created') c.status++
      else if (a.kind === 'priority') c.priority++
      else if (a.kind === 'assignee') c.assignee++
      else if (a.kind === 'team') c.team++
      else if (a.kind === 'meeting') c.meeting++
    }
    return c
  }, [activity])

  const filtered = useMemo(() => {
    const match = FILTERS.find((f) => f.id === filter)?.match ?? []
    const q = query.trim().toLowerCase()
    return activity.filter((a) => {
      if (match.length > 0 && !match.includes(a.kind)) return false
      if (!q) return true
      const hay = [a.text, a.taskRef ?? '', a.taskTitle ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activity, filter, query])

  const grouped = useMemo(() => {
    const now = new Date()
    const out: Record<'today' | 'yesterday' | 'week' | 'earlier', UpdateRow[]> =
      {
        today: [],
        yesterday: [],
        week: [],
        earlier: []
      }
    for (const a of filtered) out[bucketFor(a.atRaw, now)].push(a)
    return out
  }, [filtered])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-8">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className={`text-2xl font-medium ${t.text}`}>Updates</h2>
            <p className={`mt-1 text-sm ${t.textMuted}`}>
              Everything that&apos;s happened across your tasks comments, status
              moves, priority shifts and reassignments. Click any row to jump to
              its task.
            </p>
          </div>
          {activity.length > 0 && (
            <CopyButton
              primaryLabel="Copy updates"
              primaryToastLabel="updates as Markdown"
              primaryGetContent={() =>
                updatesToMarkdown(filtered, {
                  title: 'Updates',
                  scopeLabel: filter === 'all' ? undefined : `Filter: ${filter}`
                })
              }
              menu={buildUpdatesCopyMenu({
                allActivity: activity,
                filteredActivity: filtered,
                filterLabel: filter === 'all' ? undefined : `Filter: ${filter}`
              })}
            />
          )}
        </header>

        {activity.length === 0 ? (
          <div
            className={`flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center ${t.border}`}
          >
            <span
              className={`flex size-12 items-center justify-center rounded-full border ${t.border} ${t.surfaceMuted}`}
            >
              <Bell className={`size-5 ${t.textSubtle}`} />
            </span>
            <h3 className={`text-sm font-medium ${t.text}`}>No updates yet</h3>
            <p className={`max-w-sm text-xs leading-relaxed ${t.textMuted}`}>
              Updates show up here when tasks move between columns, comments are
              posted, or someone mentions you. Try moving a card or leaving a
              comment.
            </p>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h3
                className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
              >
                Filter
              </h3>
              <div className="relative">
                <Search
                  className={`pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 ${t.textSubtle}`}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search updates, task refs, titles…"
                  className={`h-9 w-full rounded-md border pr-3 pl-8 text-xs ${t.input}`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const active = filter === f.id
                  const n = counts[f.id]
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition ${
                        active ? t.chipActive + ' border-transparent' : t.chip
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                          active
                            ? mode === 'light'
                              ? 'bg-white/20 text-white'
                              : 'bg-black/30 text-white'
                            : t.surfaceMuted + ' ' + t.textSubtle
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {filtered.length === 0 ? (
              <p className={`py-10 text-center text-xs italic ${t.textSubtle}`}>
                No updates match your filters.
              </p>
            ) : (
              BUCKETS.map((b) =>
                grouped[b.id].length === 0 ? null : (
                  <section key={b.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
                      >
                        {b.label}
                      </h3>
                      <span
                        className={`text-[10px] tabular-nums ${t.textSubtle}`}
                      >
                        {grouped[b.id].length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {grouped[b.id].map((a) => {
                        const Icon = kindIcon(a.kind)
                        const tone = kindTone(a.kind, mode)
                        const clickable = Boolean(a.taskId || a.meetingId)
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => {
                                // Meeting rows: reviewed → share page
                                // (has the recap), everything else →
                                // inbox sheet. Task rows open the task.
                                // Team rows are informational.
                                if (a.taskId) {
                                  onOpenTask(a.taskId)
                                } else if (a.meetingId) {
                                  if (
                                    a.meetingAction === 'meeting.reviewed' &&
                                    typeof window !== 'undefined'
                                  ) {
                                    window.open(
                                      `/share/meeting/${a.meetingId}`,
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  } else {
                                    onOpenMeeting(a.meetingId)
                                  }
                                }
                              }}
                              disabled={!clickable}
                              className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-default ${t.column} ${clickable ? t.rowHover : ''}`}
                            >
                              <span
                                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${tone}`}
                              >
                                <Icon className="size-3.5" />
                              </span>
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  {a.taskRef && (
                                    <span
                                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wider tabular-nums ${t.metaTag}`}
                                    >
                                      {a.taskRef}
                                    </span>
                                  )}
                                  {a.taskTitle && (
                                    <span
                                      className={`truncate text-xs ${t.textMuted}`}
                                    >
                                      {a.taskTitle}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-sm leading-snug ${t.text}`}
                                >
                                  {a.text}
                                </span>
                              </div>
                              <span
                                className={`shrink-0 self-center text-[10px] tracking-wider uppercase ${t.textSubtle}`}
                              >
                                {a.at}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function SettingsPanel({
  density,
  setDensity,
  wipLimit,
  setWipLimit,
  showHints,
  setShowHints,
  onboardingComplete,
  accessTier
}: {
  density: 'compact' | 'cozy'
  setDensity: (d: 'compact' | 'cozy') => void
  wipLimit: number
  setWipLimit: (n: number) => void
  showHints: boolean
  setShowHints: (b: boolean) => void
  // When the member has finished onboarding, the sidebar drops its
  // "Finish your profile" / "Take a tour" block; we surface the same two
  // actions here so they stay accessible without crowding the nav.
  onboardingComplete: boolean
  // Admin-only sections (Google Calendar connect) gate on this.
  accessTier: 'admin' | 'lead' | 'member'
}) {
  const { t, mode, toggle } = useDashTheme()
  const router = useRouter()
  const push = usePushSubscription()
  const install = useInstallPrompt()

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <h2 className={`text-lg font-medium ${t.text}`}>Workspace settings</h2>

        <Row label="Install app">
          {install.state === 'installed' ? (
            <span className={`text-[11px] ${t.textMuted}`}>Installed.</span>
          ) : install.state === 'available' ? (
            <button
              onClick={() => install.prompt()}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
            >
              Install Backstage
            </button>
          ) : install.state === 'ios-manual' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              On iOS: tap Share -&gt; Add to Home Screen, then open it from
              there to receive push notifications.
            </span>
          ) : (
            <span className={`text-[11px] ${t.textMuted}`}>
              Use your browser&apos;s install / Add-to-home-screen option.
            </span>
          )}
        </Row>

        <Row label="Notifications">
          {push.permission === 'unsupported' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              This browser doesn&apos;t support web push.
              {install.state !== 'installed'
                ? ' On iOS you need to install Backstage first.'
                : ''}
            </span>
          ) : push.permission === 'denied' ? (
            <span className={`text-[11px] ${t.textMuted}`}>
              Blocked at the browser level. Enable in site settings.
            </span>
          ) : (
            <button
              onClick={() => (push.subscribed ? push.disable() : push.enable())}
              aria-pressed={push.subscribed}
              disabled={push.busy}
              className={`relative h-6 w-11 rounded-full border transition disabled:opacity-50 ${
                push.subscribed
                  ? 'border-teal-500 bg-teal-500'
                  : t.surfaceMuted + ' ' + t.border
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                  push.subscribed ? 'translate-x-0' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}
        </Row>

        {push.subscribed && (
          <Row label="Test notification">
            <button
              onClick={async () => {
                const res = await sendSelfTestPush()
                if ('error' in res) {
                  toast.error(res.error)
                  return
                }
                toast.success(
                  `Sent ${res.sent} · pruned ${res.pruned} · failed ${res.failed}`
                )
              }}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
            >
              Send to my devices
            </button>
          </Row>
        )}

        <EmailNotifications />

        {accessTier === 'admin' && <GoogleCalendarConnection />}

        {onboardingComplete && (
          <Row label="Profile">
            <button
              onClick={() => {
                window.location.href = '/onboarding'
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${t.border} ${t.tab}`}
            >
              <UserCog className="size-3.5" /> Edit profile
            </button>
          </Row>
        )}

        <Row label="Theme">
          <button
            onClick={toggle}
            aria-label={
              mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
            }
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${t.border} ${t.tab}`}
          >
            {mode === 'light' ? (
              <>
                <Moon className="size-3.5" /> Switch to dark
              </>
            ) : (
              <>
                <Sun className="size-3.5" /> Switch to light
              </>
            )}
          </button>
        </Row>

        <Row label="Card density">
          <ToggleGroup
            value={density}
            onChange={(v) => setDensity(v as 'compact' | 'cozy')}
            options={[
              { id: 'compact', label: 'Compact' },
              { id: 'cozy', label: 'Cozy' }
            ]}
          />
        </Row>

        {/* WIP limit per column - hidden for now.
        <Row label="WIP limit per column">
          <input
            type="number"
            min={0}
            value={wipLimit}
            onChange={(e) => setWipLimit(Math.max(0, Number(e.target.value)))}
            className={`h-9 w-24 rounded-md border px-2 text-xs ${t.input}`}
          />
        </Row>
        */}

        <Row label="Show help hints">
          <button
            onClick={() => setShowHints(!showHints)}
            aria-pressed={showHints}
            className={`relative h-6 w-11 rounded-full border transition ${
              showHints
                ? 'border-teal-500 bg-teal-500'
                : t.surfaceMuted + ' ' + t.border
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                showHints ? 'translate-x-0' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>

        {onboardingComplete && (
          <Row label="Walkthrough">
            <button
              onClick={() => startDashboardTour(router)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${t.border} ${t.tab}`}
            >
              <Compass className="size-3.5" /> Take a tour
            </button>
          </Row>
        )}
      </div>
    </div>
  )
}

function EmailNotifications() {
  const { t } = useDashTheme()
  const [prefs, setPrefs] = useState<{
    mentions: boolean
    assigned: boolean
    meetings: boolean
  } | null>(null)
  const [saving, setSaving] = useState<
    null | 'mentions' | 'assigned' | 'meetings'
  >(null)

  useEffect(() => {
    let alive = true
    getMyEmailPrefs().then((res) => {
      if (!alive) return
      if ('prefs' in res) setPrefs(res.prefs)
    })
    return () => {
      alive = false
    }
  }, [])

  async function toggle(key: 'mentions' | 'assigned' | 'meetings') {
    if (!prefs) return
    const next = !prefs[key]
    setPrefs({ ...prefs, [key]: next })
    setSaving(key)
    const res = await updateMyEmailPrefs({ [key]: next })
    if ('error' in res) {
      toast.error(res.error)
      setPrefs({ ...prefs })
    } else {
      setPrefs(res.prefs)
    }
    setSaving(null)
  }

  const rows: Array<{
    key: 'mentions' | 'assigned' | 'meetings'
    label: string
  }> = [
    { key: 'mentions', label: 'Email on mention' },
    { key: 'assigned', label: 'Email when assigned a task' },
    { key: 'meetings', label: 'Email for meeting requests' }
  ]

  return (
    <>
      {rows.map((row) => {
        const on = prefs?.[row.key] ?? true
        const isSaving = saving === row.key
        return (
          <Row key={row.key} label={row.label}>
            <button
              onClick={() => toggle(row.key)}
              aria-pressed={on}
              disabled={prefs === null || isSaving}
              className={`relative h-6 w-11 rounded-full border transition disabled:opacity-50 ${
                on
                  ? 'border-teal-500 bg-teal-500'
                  : t.surfaceMuted + ' ' + t.border
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                  on ? 'translate-x-0' : 'translate-x-0.5'
                }`}
              />
            </button>
          </Row>
        )
      })}
    </>
  )
}

function GoogleCalendarConnection() {
  const { t } = useDashTheme()
  const [status, setStatus] = useState<null | {
    configured: boolean
    connected: boolean
    connectedAt: string | null
    lastUsedAt: string | null
    googleEmail: string | null
    connectedByName: string | null
  }>(null)
  const [busy, startBusy] = useTransition()

  async function refresh() {
    const res = await getGoogleConnectionStatus()
    if (res && !('error' in res)) {
      setStatus(res)
    }
  }

  useEffect(() => {
    refresh()
    // Pick up the ?google=... callback param. We do this once on mount;
    // the callback route redirects back to /dashboard/settings with one
    // of: connected | admin_only | bad_state | <error message>.
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const flag = sp.get('google')
    if (flag) {
      if (flag === 'connected') {
        toast.success('Google Calendar connected.')
      } else if (flag === 'admin_only') {
        toast.error('Only an admin can connect the workspace calendar.')
      } else if (flag === 'bad_state' || flag === 'state_mismatch') {
        toast.error('Link expired. Try connecting again.')
      } else if (flag !== 'missing_params' && flag !== 'not_signed_in') {
        toast.error(`Google: ${decodeURIComponent(flag)}`)
      }
      sp.delete('google')
      const qs = sp.toString()
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}`
      )
    }
  }, [])

  function disconnect() {
    startBusy(async () => {
      const res = await disconnectGoogle()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Disconnected.')
      refresh()
    })
  }

  if (!status) return null
  if (!status.configured) {
    return (
      <Row label="Google Calendar">
        <span className={`text-[11px] ${t.textMuted}`}>
          Not configured. Server is missing GOOGLE_CLIENT_ID / SECRET.
        </span>
      </Row>
    )
  }
  if (!status.connected) {
    return (
      <Row label="Google Calendar">
        <a
          href="/api/google/oauth/start"
          className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
        >
          Connect
        </a>
      </Row>
    )
  }
  return (
    <Row label="Google Calendar">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] ${t.textMuted}`}>
          {status.googleEmail
            ? `Connected as ${status.googleEmail}`
            : `Connected by ${status.connectedByName ?? 'someone'}`}
        </span>
        <button
          onClick={disconnect}
          disabled={busy}
          className={`h-7 rounded-md border px-2 text-[11px] disabled:opacity-40 ${t.btn}`}
        >
          Disconnect
        </button>
      </div>
    </Row>
  )
}

function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${t.text}`}>{label}</span>
      {children}
    </div>
  )
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded px-2.5 py-1 text-xs transition ${
            value === opt.id ? t.tabActive : t.tab
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
