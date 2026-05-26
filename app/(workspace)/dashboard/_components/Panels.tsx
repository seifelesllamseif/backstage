'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  Bell,
  Check,
  ExternalLink,
  FileText,
  Flag,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link as LinkIcon,
  MessageCircleQuestion,
  MessageSquare,
  MoreHorizontal,
  MoveRight,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Sparkles,
  UserCog,
  X
} from 'lucide-react'
import { BoardTask } from './boardData'
import type {
  ProjectExternalRef,
  TaskExternalRefKind
} from './boardData'
import {
  defaultExternalRefLabel,
  parseExternalRef
} from '@/lib/externalRef'
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
} from '@/app/(authenticated)/projects/actions'
import { setProjectGithubRepo } from '../actions'
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
  onOpenProject,
  refsByProject,
  onAddProjectRef,
  onRemoveProjectRef,
  renderCopySlot
}: {
  tasks: BoardTask[]
  projects: ProjectRow[]
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
  onOpenProject: (id: string) => void
  refsByProject: Record<string, ProjectExternalRef[]>
  onAddProjectRef: (projectId: string, url: string) => void
  onRemoveProjectRef: (projectId: string, refId: string) => void
  // Optional per-project copy-button factory. DashboardShell owns the
  // export context so it injects a CopyButton per project here.
  renderCopySlot?: (projectId: string) => React.ReactNode
}) {
  const { t } = useDashTheme()
  const router = useRouter()
  const canEdit = accessTier === 'admin' || accessTier === 'lead'
  const [pending, startTransition] = useTransition()
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = useState<ProjectRow | null>(null)

  // Group tasks by projectId so each card can show real progress for the
  // current member's visible task set. `tasks` is already filtered to
  // visibleTasks in DashboardShell, so members see only their own counts.
  const byProject = new Map<string, BoardTask[]>()
  for (const task of tasks) {
    const pid = task.projectId
    if (!pid) continue
    const list = byProject.get(pid) ?? []
    list.push(task)
    byProject.set(pid, list)
  }

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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
    })
  }

  const renderCard = (project: ProjectRow) => {
    const list = byProject.get(project.id) ?? []
    const done = list.filter((x) => x.status === 'done').length
    const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100)
    return (
      <ProjectCard
        key={project.id}
        project={project}
        tasks={list}
        refs={refsByProject[project.id] ?? []}
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
        copySlot={renderCopySlot?.(project.id)}
        disabled={pending}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <header className="flex items-baseline justify-between">
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
          {canEdit && !showNew && (
            <button
              onClick={() => setShowNew(true)}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
            >
              New project
            </button>
          )}
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map(renderCard)}
          </div>
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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {archivedProjects.map(renderCard)}
            </div>
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
  copySlot,
  disabled
}: {
  project: ProjectRow
  tasks: BoardTask[]
  refs: ProjectExternalRef[]
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

  return (
    <div
      role={cardClickable ? 'button' : undefined}
      tabIndex={cardClickable ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      aria-label={cardClickable ? `Open ${project.name}` : undefined}
      className={`flex flex-col gap-3 rounded-xl border p-4 transition ${t.column} ${
        cardClickable
          ? 'cursor-pointer hover:border-zinc-400 dark:hover:border-white/30'
          : ''
      } ${project.isArchived ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
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
                className={`h-7 w-full rounded-md border px-2 text-sm ${t.input}`}
              />
              <button
                type="submit"
                disabled={disabled}
                onClick={stop}
                className={`h-7 rounded-md px-2 text-[10px] ${t.accent}`}
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
                className={`h-7 rounded-md border px-2 text-[10px] ${t.btn}`}
              >
                Cancel
              </button>
            </form>
          ) : (
            <span className={`truncate text-sm font-medium ${t.text}`}>
              {project.name}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
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

        {canEdit && !isEditing && (
          <div className="relative" onClick={stop}>
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

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${t.textMuted}`}>
          {tasks.length === 0 ? 'No tasks' : `${done}/${tasks.length} done`}
        </span>
        <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
          {pct}%
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-red-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tasks.slice(0, 4).map((task) => (
            <li
              key={task.id}
              className={`flex items-center gap-2 text-xs ${t.textMuted}`}
            >
              <StatusIcon status={task.status} className="size-3 shrink-0" />
              <span className="truncate">{task.title}</span>
            </li>
          ))}
          {tasks.length > 4 && (
            <li className={`text-[10px] italic ${t.textSubtle}`}>
              +{tasks.length - 4} more
            </li>
          )}
        </ul>
      )}

      <RepoField project={project} canEdit={canEdit} stop={stop} />

      <ProjectLinksField
        refs={refs}
        onAdd={onAddRef}
        onRemove={onRemoveRef}
        stop={stop}
      />

      {copySlot && (
        <div className="flex" onClick={stop}>
          {copySlot}
        </div>
      )}
    </div>
  )
}

function refIconForKind(kind: TaskExternalRefKind) {
  switch (kind) {
    case 'pr':
      return GitPullRequest
    case 'issue':
      return MessageCircleQuestion
    case 'commit':
      return GitCommit
    case 'doc':
      return FileText
    case 'link':
    default:
      return LinkIcon
  }
}

function ProjectLinksField({
  refs,
  onAdd,
  onRemove,
  stop
}: {
  refs: ProjectExternalRef[]
  onAdd: (url: string) => void
  onRemove: (refId: string) => void
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
        {refs.map((ref) => {
          const parsed = parseExternalRef(ref.url)
          const label =
            ref.label ?? (parsed ? defaultExternalRefLabel(parsed) : ref.url)
          const Icon = refIconForKind(ref.kind)
          return (
            <li
              key={ref.id}
              className={`group flex items-center gap-2 rounded-md border px-2 py-1 ${t.surfaceMuted}`}
            >
              <Icon className={`size-3 shrink-0 ${t.textMuted}`} />
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={stop}
                className={`flex min-w-0 flex-1 items-center gap-1 text-[11px] ${t.text}`}
                title={ref.url}
              >
                <span className="truncate">{label}</span>
                <ExternalLink className={`size-2.5 shrink-0 ${t.textSubtle}`} />
              </a>
              <button
                onClick={() => onRemove(ref.id)}
                className={`flex size-4 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
                aria-label="Remove link"
              >
                <X className="size-2.5" />
              </button>
            </li>
          )
        })}
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

function RepoField({
  project,
  canEdit,
  stop
}: {
  project: ProjectRow
  canEdit: boolean
  stop: (e: React.MouseEvent | React.KeyboardEvent) => void
}) {
  const { t } = useDashTheme()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(project.githubRepo ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const res = await setProjectGithubRepo({
      projectId: project.id,
      githubRepo: value.trim()
    })
    setSaving(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success(value.trim() ? 'Repo linked.' : 'Repo cleared.')
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <form
        onClick={stop}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex items-center gap-1.5"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/repo"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setValue(project.githubRepo ?? '')
              setEditing(false)
            }
          }}
          className={`h-7 flex-1 rounded-md border px-2 text-[11px] ${t.input}`}
        />
        <button
          type="submit"
          disabled={saving}
          className={`h-7 rounded-md px-2 text-[10px] disabled:opacity-50 ${t.accent}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(project.githubRepo ?? '')
            setEditing(false)
          }}
          className={`h-7 rounded-md border px-2 text-[10px] ${t.btn}`}
        >
          Cancel
        </button>
      </form>
    )
  }

  if (project.githubRepo) {
    return (
      <div className="flex items-center justify-between gap-2" onClick={stop}>
        <a
          href={`https://github.com/${project.githubRepo}`}
          target="_blank"
          rel="noreferrer noopener"
          className={`flex min-w-0 items-center gap-1.5 text-[11px] ${t.textMuted} hover:${t.text}`}
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{project.githubRepo}</span>
        </a>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className={`flex size-6 items-center justify-center rounded ${t.btn}`}
            aria-label="Edit repo"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
    )
  }

  if (!canEdit) return null
  return (
    <button
      onClick={(e) => {
        stop(e)
        setEditing(true)
      }}
      className={`flex items-center gap-1.5 self-start text-[11px] ${t.textSubtle} hover:${t.text}`}
    >
      <GitBranch className="size-3" /> Link GitHub repo
    </button>
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

interface UpdateRow {
  id: string
  kind: UpdateKind
  text: string
  at: string
  atRaw: string
  taskId: string
  taskRef: string | null
  taskTitle: string | null
}

type UpdateFilter = 'all' | 'comment' | 'status' | 'priority' | 'assignee'

const FILTERS: { id: UpdateFilter; label: string; match: UpdateKind[] }[] = [
  { id: 'all', label: 'All', match: [] },
  { id: 'comment', label: 'Comments', match: ['comment'] },
  { id: 'status', label: 'Status', match: ['status', 'created'] },
  { id: 'priority', label: 'Priority', match: ['priority'] },
  { id: 'assignee', label: 'Assignees', match: ['assignee'] }
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
  scope: Exclude<TimeScope, 'all' | 'cycle'>
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
  onOpenTask
}: {
  activity: UpdateRow[]
  onOpenTask: (taskId: string) => void
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
      assignee: 0
    }
    for (const a of activity) {
      if (a.kind === 'comment') c.comment++
      else if (a.kind === 'status' || a.kind === 'created') c.status++
      else if (a.kind === 'priority') c.priority++
      else if (a.kind === 'assignee') c.assignee++
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
              moves, priority shifts and reassignments. Click any row to jump
              to its task.
            </p>
          </div>
          {activity.length > 0 && (
            <CopyButton
              primaryLabel="Copy updates"
              primaryToastLabel="updates as Markdown"
              primaryGetContent={() =>
                updatesToMarkdown(filtered, {
                  title: 'Updates',
                  scopeLabel:
                    filter === 'all' ? undefined : `Filter: ${filter}`
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
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => onOpenTask(a.taskId)}
                              className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${t.column} ${t.rowHover}`}
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
  notifyOnAssign,
  setNotifyOnAssign,
  showHints,
  setShowHints,
  onClearTasks
}: {
  density: 'compact' | 'cozy'
  setDensity: (d: 'compact' | 'cozy') => void
  wipLimit: number
  setWipLimit: (n: number) => void
  notifyOnAssign: boolean
  setNotifyOnAssign: (b: boolean) => void
  showHints: boolean
  setShowHints: (b: boolean) => void
  onClearTasks: () => void
}) {
  const { t } = useDashTheme()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <h2 className={`text-lg font-medium ${t.text}`}>Workspace settings</h2>

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

        <Row label="WIP limit per column">
          <input
            type="number"
            min={0}
            value={wipLimit}
            onChange={(e) => setWipLimit(Math.max(0, Number(e.target.value)))}
            className={`h-9 w-24 rounded-md border px-2 text-xs ${t.input}`}
          />
        </Row>

        <Row label="Notify on assignment">
          <button
            onClick={() => setNotifyOnAssign(!notifyOnAssign)}
            className={`relative h-6 w-11 rounded-full border transition ${
              notifyOnAssign
                ? 'border-red-500 bg-red-500'
                : t.surfaceMuted + ' ' + t.border
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                notifyOnAssign ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>

        <Row label="Show help hints">
          <button
            onClick={() => setShowHints(!showHints)}
            aria-pressed={showHints}
            className={`relative h-6 w-11 rounded-full border transition ${
              showHints
                ? 'border-red-500 bg-red-500'
                : t.surfaceMuted + ' ' + t.border
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
                showHints ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>

        <div className={`border-t pt-5 ${t.border}`}>
          <h3 className={`mb-2 text-sm font-medium ${t.text}`}>Danger zone</h3>
          <p className={`mb-3 text-xs ${t.textMuted}`}>
            Reset the board back to the seeded Verbivoretasks. This clears your
            local edits.
          </p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className={`h-9 rounded-md border px-3 text-xs ${t.btn}`}
            >
              Reset board
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${t.text}`}>Are you sure?</span>
              <button
                onClick={() => {
                  onClearTasks()
                  setConfirming(false)
                }}
                className={`h-8 rounded-md px-3 text-xs ${t.accent}`}
              >
                Reset
              </button>
              <button
                onClick={() => setConfirming(false)}
                className={`h-8 rounded-md border px-3 text-xs ${t.btn}`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
