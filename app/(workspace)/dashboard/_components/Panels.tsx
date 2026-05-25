'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Archive as ArchiveIcon,
  Bell,
  MoreHorizontal,
  Pencil,
  Plus,
  X
} from 'lucide-react'
import { BoardTask } from './boardData'
import StatusIcon from './StatusIcon'
import { useDashTheme } from './theme'
import {
  archiveProjectInPlace,
  createProjectInPlace,
  renameProject
} from '@/app/(authenticated)/projects/actions'
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
}

export function ProjectsPanel({
  tasks,
  projects,
  currentUserId,
  accessTier
}: {
  tasks: BoardTask[]
  projects: ProjectRow[]
  currentUserId: string
  accessTier: 'admin' | 'lead' | 'member'
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className={`text-lg font-medium ${t.text}`}>Projects</h2>
            <p className={`text-xs ${t.textMuted}`}>
              {canEdit
                ? `${visibleProjects.length} active`
                : `${visibleProjects.length} you're working on`}
            </p>
          </div>
          {canEdit && !showNew && (
            <button
              onClick={() => setShowNew(true)}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
            >
              <Plus className="size-3.5" />
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
                  ? `"${pendingArchive.name}" will be hidden from project lists. Its tasks and history stay intact and you can restore it from the standalone if /projects page.`
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

        {visibleProjects.length === 0 ? (
          <EmptyState canEdit={canEdit} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => {
              const list = byProject.get(project.id) ?? []
              const done = list.filter((x) => x.status === 'done').length
              const pct =
                list.length === 0 ? 0 : Math.round((done / list.length) * 100)
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  tasks={list}
                  done={done}
                  pct={pct}
                  canEdit={canEdit}
                  isEditing={editingId === project.id}
                  onStartEdit={() => setEditingId(project.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onRename={(name) => handleRename(project.id, name)}
                  onArchive={() => setPendingArchive(project)}
                  disabled={pending}
                />
              )
            })}
          </div>
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
  done,
  pct,
  canEdit,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onRename,
  onArchive,
  disabled
}: {
  project: ProjectRow
  tasks: BoardTask[]
  done: number
  pct: number
  canEdit: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onRename: (name: string) => void
  onArchive: () => void
  disabled: boolean
}) {
  const { t } = useDashTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${t.column}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (renameValue.trim().length >= 2) onRename(renameValue.trim())
              }}
              className="flex items-center gap-1"
            >
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
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
                className={`h-7 rounded-md px-2 text-[10px] ${t.accent}`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenameValue(project.name)
                  onCancelEdit()
                }}
                className={`h-7 rounded-md border px-2 text-[10px] ${t.btn}`}
              >
                Cancel
              </button>
            </form>
          ) : (
            <Link
              href={`/projects/${project.id}`}
              className={`truncate text-sm font-medium hover:underline ${t.text}`}
            >
              {project.name}
            </Link>
          )}
          <span
            className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[9px] tracking-wider uppercase ${t.metaTag}`}
          >
            {project.kind}
          </span>
        </div>

        {canEdit && !isEditing && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex size-7 items-center justify-center rounded-md border transition ${t.btn}`}
              aria-label="Project actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className={`absolute top-8 right-0 z-40 w-40 rounded-md border py-1 shadow-xl ${t.detail}`}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onStartEdit()
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab}`}
                  >
                    <Pencil className="size-3.5" /> Rename
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onArchive()
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${t.tab} ${t.accentText}`}
                  >
                    <ArchiveIcon className="size-3.5" /> Archive
                  </button>
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

export function UpdatesPanel({
  activity
}: {
  activity: { id: string; text: string; at: string }[]
}) {
  const { t } = useDashTheme()
  if (activity.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span
            className={`flex size-12 items-center justify-center rounded-full border ${t.border} ${t.surfaceMuted}`}
          >
            <Bell className={`size-5 ${t.textSubtle}`} />
          </span>
          <h3 className={`text-sm font-medium ${t.text}`}>No updates yet</h3>
          <p className={`text-xs leading-relaxed ${t.textMuted}`}>
            Updates show up here when tasks move between columns, comments are
            posted, or someone mentions you. Try moving a card or leaving a
            comment.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full overflow-y-auto">
      <ul className="mx-auto flex max-w-2xl flex-col gap-2">
        {activity.map((a) => (
          <li
            key={a.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${t.column}`}
          >
            <span className={t.text}>{a.text}</span>
            <span
              className={`text-[10px] tracking-wider uppercase ${t.textSubtle}`}
            >
              {a.at}
            </span>
          </li>
        ))}
      </ul>
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
  onClearTasks
}: {
  density: 'compact' | 'cozy'
  setDensity: (d: 'compact' | 'cozy') => void
  wipLimit: number
  setWipLimit: (n: number) => void
  notifyOnAssign: boolean
  setNotifyOnAssign: (b: boolean) => void
  onClearTasks: () => void
}) {
  const { t } = useDashTheme()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
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
