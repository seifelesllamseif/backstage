'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, RotateCcw, Sun, Moon } from 'lucide-react'
import {
  addComment as addCommentAction,
  createDashboardTask,
  deleteDashboardTask,
  duplicateDashboardTask,
  updateDashboardTaskAssignee,
  updateDashboardTaskPriority,
  updateDashboardTaskStatus
} from '../actions'
import type {
  BoardAssignee,
  BoardTask,
  Cycle
} from './boardData'
import {
  STATUSES,
  STATUS_BY_ID,
  TaskPriority,
  TaskStatus,
  PRIORITY_LABEL
} from './status'
import BoardColumn from './BoardColumn'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import TaskDetail, { TaskActivity, TaskComment } from './TaskDetail'
import NewTaskModal from './NewTaskModal'
import Timeline from './Timeline'
import FilterPanel from './FilterPanel'
import { ProjectsPanel, SettingsPanel, UpdatesPanel } from './Panels'
import SymbolsPanel from './SymbolsPanel'
import ArchivePanel from './ArchivePanel'
import Avatar from './Avatar'
import { DashboardThemeProvider, useDashTheme } from './theme'
import { ContextMenuProvider, useContextMenu } from './ContextMenu'
import { TaskActionsProvider } from './actions'
import { TeamProvider } from './TeamContext'

export type GroupBy = 'status' | 'assignee' | 'priority'
export type View =
  | 'all'
  | 'mine'
  | 'inbox'
  | 'projects'
  | 'updates'
  | 'settings'
  | 'symbols'
  | 'archive'

export interface DashboardInitial {
  tasks: BoardTask[]
  members: BoardAssignee[]
  cycles: Cycle[]
  projects: { id: string; name: string }[]
  labels: { id: string; name: string }[]
  currentMember: {
    id: string
    fullName: string
    accessTier: 'admin' | 'lead' | 'member'
  }
  currentProjectId: string | null
  defaultProjectId: string | null
}

function nowLabel() {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

export default function DashboardShellWrapper(props: { initial: DashboardInitial }) {
  return (
    <DashboardThemeProvider initial="light">
      <ContextMenuProvider>
        <TeamProvider members={props.initial.members}>
          <DashboardShellInner {...props} />
        </TeamProvider>
      </ContextMenuProvider>
    </DashboardThemeProvider>
  )
}

function DashboardShellInner({ initial }: { initial: DashboardInitial }) {
  const { t, toggle, mode } = useDashTheme()
  const { open: openMenu } = useContextMenu()
  const router = useRouter()
  const mainScrollRef = useRef<HTMLElement | null>(null)
  const [, startTransition] = useTransition()

  const currentUserId = initial.currentMember.id
  const isAdmin = initial.currentMember.accessTier === 'admin'

  const team = initial.members
  // Ensure the signed-in user is always discoverable even if they have no
  // tasks in this slice (mapMembers returns everyone, but we fall back to a
  // synthesized record so role/avatar still render).
  const currentUser: BoardAssignee =
    team.find((m) => m.id === currentUserId) ?? {
      id: currentUserId,
      initials: initial.currentMember.fullName.slice(0, 2).toUpperCase(),
      name: initial.currentMember.fullName,
      color: 'bg-zinc-500/80',
      role: initial.currentMember.accessTier
    }

  const [tasks, setTasks] = useState<BoardTask[]>(initial.tasks)
  const [comments, setComments] = useState<Record<string, TaskComment[]>>({})
  const [activity, setActivity] = useState<Record<string, TaskActivity[]>>({})

  const [view, setView] = useState<View>('all')
  const [tab, setTab] = useState<'board' | 'list' | 'timeline'>('board')
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [groupOpen, setGroupOpen] = useState(false)

  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus>('todo')

  const [density, setDensity] = useState<'compact' | 'cozy'>('cozy')
  const [wipLimit, setWipLimit] = useState(0)
  const [notifyOnAssign, setNotifyOnAssign] = useState(true)

  const labelIdByName = useMemo(
    () => new Map(initial.labels.map((l) => [l.name, l.id])),
    [initial.labels]
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((task) => task.tags?.forEach((tag) => set.add(tag)))
    return [...set].sort()
  }, [tasks])

  const visibleTasks = useMemo(
    () =>
      isAdmin
        ? tasks
        : tasks.filter((task) => task.assignee?.id === currentUserId),
    [tasks, isAdmin, currentUserId]
  )

  const filtered = useMemo(() => {
    let list = visibleTasks

    if (view === 'mine')
      list = list.filter((task) => task.assignee?.id === currentUserId)
    if (view === 'inbox')
      list = list.filter(
        (task) => task.status === 'todo' || task.status === 'in_review'
      )

    if (statusFilter) list = list.filter((task) => task.status === statusFilter)
    if (priorityFilter)
      list = list.filter((task) => task.priority === priorityFilter)
    if (assigneeFilter)
      list = list.filter((task) => task.assignee?.id === assigneeFilter)
    if (tagFilter) list = list.filter((task) => task.tags?.includes(tagFilter))
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.ref.toLowerCase().includes(q) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }
    return list
  }, [
    visibleTasks,
    view,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    tagFilter,
    query,
    currentUserId
  ])

  const counts = {
    all: visibleTasks.length,
    mine: visibleTasks.filter((task) => task.assignee?.id === currentUserId)
      .length,
    inbox: visibleTasks.filter(
      (task) => task.status === 'todo' || task.status === 'in_review'
    ).length
  }

  const totals = {
    open: filtered.filter((task) => !['done', 'canceled'].includes(task.status))
      .length,
    due: filtered.filter((task) => task.priority === 'urgent').length,
    review: filtered.filter((task) => task.status === 'in_review').length,
    done: filtered.filter((task) => task.status === 'done').length
  }

  const logActivityLocal = (taskId: string, text: string) => {
    setActivity((cur) => {
      const list = cur[taskId] ?? []
      return {
        ...cur,
        [taskId]: [
          ...list,
          { id: nextId('act'), kind: 'status', text, at: nowLabel() }
        ]
      }
    })
  }

  const updateStatus = (id: string, s: TaskStatus) => {
    // Track the prior status so we can revert if the server rejects the
    // change — most commonly the slice-2 handoff gate blocking a move to
    // Done (decision 0015, 0022). Surfacing a proper toast for the
    // rejection lands in 3a step 5; until then, the card snapping back
    // to its prior column is the user-visible signal.
    const prev = tasks.find((t) => t.id === id)
    const prevStatus = prev?.status
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id
          ? { ...task, status: s, updatedAt: new Date().toISOString() }
          : task
      )
    )
    logActivityLocal(id, `Status set to ${STATUS_BY_ID[s].label}`)
    startTransition(async () => {
      const res = await updateDashboardTaskStatus(id, s)
      if (!res.ok) {
        console.error('updateStatus:', res.message)
        if (prevStatus !== undefined) {
          setTasks((cur) =>
            cur.map((task) =>
              task.id === id ? { ...task, status: prevStatus } : task
            )
          )
        }
        if (res.reason === 'handoff-incomplete' && res.taskUrl) {
          // Temporary: alert until sonner toasts land in 3a step 5.
          // The taskUrl points at the slice-1 edit page where handoffs
          // can be filled.
          if (typeof window !== 'undefined') {
            window.alert(`${res.message}\n\nOpen: ${res.taskUrl}`)
          }
        }
      }
    })
  }

  const updatePriority = (id: string, p: TaskPriority) => {
    setTasks((cur) =>
      cur.map((task) => (task.id === id ? { ...task, priority: p } : task))
    )
    logActivityLocal(id, `Priority set to ${PRIORITY_LABEL[p]}`)
    startTransition(async () => {
      const res = await updateDashboardTaskPriority(id, p)
      if ('error' in res) console.error('updatePriority:', res.error)
    })
  }

  const updateAssignee = (id: string, assigneeId: string | null) => {
    const member = assigneeId ? team.find((m) => m.id === assigneeId) : undefined
    setTasks((cur) =>
      cur.map((task) =>
        task.id === id ? { ...task, assignee: member ?? undefined } : task
      )
    )
    logActivityLocal(id, member ? `Assigned to ${member.name}` : 'Unassigned')
    startTransition(async () => {
      const res = await updateDashboardTaskAssignee(id, assigneeId)
      if ('error' in res) console.error('updateAssignee:', res.error)
    })
  }

  const addComment = (id: string, body: string, mentions?: string[]) => {
    setComments((cur) => {
      const list = cur[id] ?? []
      return {
        ...cur,
        [id]: [
          ...list,
          {
            id: nextId('cm'),
            author: currentUser.name,
            body,
            at: nowLabel(),
            mentions
          }
        ]
      }
    })
    setActivity((cur) => {
      const list = cur[id] ?? []
      return {
        ...cur,
        [id]: [
          ...list,
          {
            id: nextId('act'),
            kind: 'comment',
            text: 'You left a comment',
            at: nowLabel()
          }
        ]
      }
    })
    startTransition(async () => {
      const res = await addCommentAction(id, body, mentions)
      if ('error' in res) console.error('addComment:', res.error)
    })
  }

  const createTask = (
    draft: Omit<BoardTask, 'id' | 'ref' | 'createdAt' | 'updatedAt'>
  ) => {
    const targetProjectId =
      initial.currentProjectId ?? initial.defaultProjectId
    if (!targetProjectId) {
      console.error('createTask: no project available; create a project first.')
      return
    }

    const tempId = nextId('t')
    const optimistic: BoardTask = {
      ...draft,
      id: tempId,
      ref: 'NEW…',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    }
    setTasks((cur) => [optimistic, ...cur])
    setActivity((cur) => ({
      ...cur,
      [tempId]: [
        {
          id: nextId('act'),
          kind: 'created',
          text: 'Task created',
          at: nowLabel()
        }
      ]
    }))
    setSelectedId(tempId)

    const labelIds = (draft.tags ?? [])
      .map((name) => labelIdByName.get(name))
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await createDashboardTask({
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        projectId: targetProjectId,
        assigneeId: draft.assignee?.id ?? null,
        dueDate: null,
        labelIds
      })
      if ('error' in res) {
        console.error('createTask:', res.error)
        setTasks((cur) => cur.filter((t) => t.id !== tempId))
        return
      }
      const serverTask = res.task
      setTasks((cur) =>
        cur.map((t) =>
          t.id === tempId
            ? {
                ...t,
                id: serverTask.id,
                ref: serverTask.ref ?? t.ref,
                createdAt: serverTask.createdAt.toISOString().slice(0, 10),
                updatedAt: serverTask.updatedAt.toISOString()
              }
            : t
        )
      )
      setActivity((cur) => {
        const entry = cur[tempId]
        if (!entry) return cur
        const { [tempId]: _, ...rest } = cur
        return { ...rest, [serverTask.id]: entry }
      })
      setSelectedId((sid) => (sid === tempId ? serverTask.id : sid))
    })
  }

  const openNewTask = (status?: TaskStatus) => {
    setNewTaskColumn(status ?? 'todo')
    setNewTaskOpen(true)
  }

  const deleteTask = (id: string) => {
    const snapshot = tasks
    setTasks((cur) => cur.filter((task) => task.id !== id))
    if (selectedId === id) setSelectedId(null)
    startTransition(async () => {
      const res = await deleteDashboardTask(id)
      if ('error' in res) {
        console.error('deleteTask:', res.error)
        setTasks(snapshot)
      }
    })
  }

  const duplicateTask = (id: string) => {
    const src = tasks.find((task) => task.id === id)
    if (!src) return
    const tempId = nextId('t')
    const optimistic: BoardTask = {
      ...src,
      id: tempId,
      ref: 'NEW…',
      title: `${src.title} (copy)`,
      status: 'duplicate',
      relations: [{ kind: 'parent', ref: src.ref }],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString()
    }
    setTasks((cur) => [optimistic, ...cur])
    startTransition(async () => {
      const res = await duplicateDashboardTask(id)
      if ('error' in res) {
        console.error('duplicateTask:', res.error)
        setTasks((cur) => cur.filter((t) => t.id !== tempId))
        return
      }
      const serverTask = res.task
      setTasks((cur) =>
        cur.map((t) =>
          t.id === tempId
            ? {
                ...t,
                id: serverTask.id,
                ref: serverTask.ref ?? t.ref,
                createdAt: serverTask.createdAt.toISOString().slice(0, 10),
                updatedAt: serverTask.updatedAt.toISOString()
              }
            : t
        )
      )
    })
  }

  const copyRef = (taskRef: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(taskRef).catch(() => {})
    }
  }

  const resetFilters = () => {
    setStatusFilter(null)
    setPriorityFilter(null)
    setAssigneeFilter(null)
    setTagFilter(null)
    setQuery('')
  }

  const refreshFromServer = () => {
    router.refresh()
    setComments({})
    setActivity({})
    setSelectedId(null)
  }

  const selected = selectedId
    ? tasks.find((task) => task.id === selectedId) ?? null
    : null

  const globalActivity = useMemo(() => {
    const all = Object.entries(activity).flatMap(([taskId, list]) => {
      const task = tasks.find((task) => task.id === taskId)
      return list.map((a) => ({
        id: a.id,
        text: task ? `[${task.ref}] ${a.text}` : a.text,
        at: a.at
      }))
    })
    return all.reverse()
  }, [activity, tasks])

  const groups: { key: string; label: string; items: BoardTask[] }[] =
    groupBy === 'status'
      ? STATUSES.map((s) => ({
          key: s.id,
          label: s.label,
          items: filtered.filter((task) => task.status === s.id)
        }))
      : groupBy === 'priority'
        ? (['urgent', 'high', 'medium', 'low', 'none'] as TaskPriority[]).map(
            (p) => ({
              key: p,
              label: PRIORITY_LABEL[p],
              items: filtered.filter((task) => task.priority === p)
            })
          )
        : [
            ...team.map((m) => ({
              key: m.id,
              label: m.name,
              items: filtered.filter((task) => task.assignee?.id === m.id)
            })),
            {
              key: 'unassigned',
              label: 'Unassigned',
              items: filtered.filter((task) => !task.assignee)
            }
          ]

  const actions = {
    changeStatus: updateStatus,
    changePriority: updatePriority,
    changeAssignee: updateAssignee,
    duplicate: duplicateTask,
    remove: deleteTask,
    copyRef,
    openDetail: setSelectedId,
    addInColumn: openNewTask,
    setStatusFilter,
    setAssigneeFilter
  }

  const onProjectChange = (projectId: string | null) => {
    const params = new URLSearchParams()
    if (projectId) params.set('project', projectId)
    const qs = params.toString()
    router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  return (
    <TaskActionsProvider value={actions}>
      <div
        className={`fixed inset-0 font-[var(--font-favorit)] flex flex-col overflow-hidden ${t.page}`}
      >
        <div
          onWheel={(e) => {
            if (view !== 'archive') return
            const scroller = document.querySelector<HTMLElement>(
              '[data-archive-scroll]'
            )
            if (scroller)
              scroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
          }}
          className={`flex items-center justify-between px-4 h-11 border-b text-xs shrink-0 ${t.topbar}`}
        >
          <Link
            href="/portfolio"
            className={`flex items-center gap-1.5 transition ${t.backLink}`}
          >
            <ArrowLeft className="size-3" />
            Back to overview
          </Link>
          <span
            className={`uppercase tracking-[0.25em] text-[10px] ${t.textMuted}`}
          >
            Skam · Task Handoff
          </span>
          <CurrentUserBadge user={currentUser} isAdmin={isAdmin} />
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 shrink-0 min-h-0">
            <Sidebar
              activeView={
                view === 'projects' ||
                view === 'updates' ||
                view === 'settings' ||
                view === 'symbols' ||
                view === 'archive'
                  ? 'all'
                  : view
              }
              onView={(v) => setView(v)}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              assigneeFilter={assigneeFilter}
              onAssigneeFilter={setAssigneeFilter}
              counts={counts}
              secondary={view}
              onSecondary={(v) => setView(v)}
            />
          </div>

          <div className="relative flex flex-col flex-1 min-w-0 min-h-0">
            <Topbar
              query={query}
              onQuery={setQuery}
              tab={tab}
              onTab={setTab}
              totals={totals}
              onNewTask={() => openNewTask()}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              filterOpen={filterOpen}
              groupBy={groupBy}
              onGroupBy={(g) => {
                setGroupBy(g)
                setGroupOpen(false)
              }}
              groupOpen={groupOpen}
              onToggleGroup={() => setGroupOpen((v) => !v)}
              projects={initial.projects}
              currentProjectId={initial.currentProjectId}
              onProjectChange={onProjectChange}
            />

            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityFilter={setPriorityFilter}
              assigneeFilter={assigneeFilter}
              onAssigneeFilter={setAssigneeFilter}
              tagFilter={tagFilter}
              onTagFilter={setTagFilter}
              allTags={allTags}
              onReset={resetFilters}
            />

            <main
              ref={(el) => {
                mainScrollRef.current = el
              }}
              onWheel={(e) => {
                if (view !== 'archive') return
                const scroller =
                  mainScrollRef.current?.querySelector<HTMLElement>(
                    '[data-archive-scroll]'
                  )
                if (!scroller || scroller.contains(e.target as Node)) return
                scroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
              }}
              className={`flex-1 min-h-0 overflow-hidden ${view === 'archive' ? 'p-0' : 'p-3'}`}
              onContextMenu={(e) => {
                const targetIsCard = (e.target as HTMLElement).closest(
                  'button[data-card]'
                )
                if (targetIsCard) return
                openMenu(e, [
                  {
                    id: 'add',
                    label: 'New task',
                    icon: <Plus className="size-3.5" />,
                    shortcut: 'N',
                    onSelect: () => openNewTask()
                  },
                  { id: 'sep', label: '', separator: true },
                  {
                    id: 'switch-board',
                    label: 'Board view',
                    disabled: tab === 'board',
                    onSelect: () => setTab('board')
                  },
                  {
                    id: 'switch-list',
                    label: 'List view',
                    disabled: tab === 'list',
                    onSelect: () => setTab('list')
                  },
                  {
                    id: 'switch-timeline',
                    label: 'Timeline view',
                    disabled: tab === 'timeline',
                    onSelect: () => setTab('timeline')
                  },
                  { id: 'sep2', label: '', separator: true },
                  {
                    id: 'toggle-theme',
                    label:
                      mode === 'light' ? 'Switch to dark' : 'Switch to light',
                    icon:
                      mode === 'light' ? (
                        <Moon className="size-3.5" />
                      ) : (
                        <Sun className="size-3.5" />
                      ),
                    onSelect: toggle
                  },
                  {
                    id: 'reset-filters',
                    label: 'Reset filters',
                    icon: <RotateCcw className="size-3.5" />,
                    onSelect: resetFilters
                  }
                ])
              }}
            >
              {(view === 'all' || view === 'mine' || view === 'inbox') && (
                <>
                  {tab === 'board' && (
                    <div className="h-full flex gap-3 min-h-0 overflow-x-auto pb-1">
                      {groups.map((g) => {
                        const status =
                          groupBy === 'status'
                            ? (STATUS_BY_ID[g.key as TaskStatus] ??
                              STATUSES[0])
                            : undefined
                        return (
                          <BoardColumn
                            key={g.key}
                            title={g.label}
                            statusId={status?.id}
                            tasks={g.items}
                            onSelect={setSelectedId}
                            onAdd={
                              groupBy === 'status'
                                ? () => openNewTask(g.key as TaskStatus)
                                : undefined
                            }
                            density={density}
                            wipLimit={wipLimit}
                          />
                        )
                      })}
                    </div>
                  )}
                  {tab === 'list' && (
                    <ListView tasks={filtered} onSelect={setSelectedId} />
                  )}
                  {tab === 'timeline' && (
                    <Timeline tasks={filtered} onSelect={setSelectedId} />
                  )}
                </>
              )}

              {view === 'projects' && <ProjectsPanel tasks={visibleTasks} />}
              {view === 'updates' && (
                <UpdatesPanel activity={globalActivity} />
              )}
              {view === 'symbols' && <SymbolsPanel />}
              {view === 'archive' && (
                <ArchivePanel
                  cycles={initial.cycles}
                  tasks={visibleTasks}
                  comments={comments}
                  activity={activity}
                  onChangeStatus={updateStatus}
                  onChangePriority={updatePriority}
                  onChangeAssignee={updateAssignee}
                  onAddComment={addComment}
                />
              )}
              {view === 'settings' && (
                <SettingsPanel
                  density={density}
                  setDensity={setDensity}
                  wipLimit={wipLimit}
                  setWipLimit={setWipLimit}
                  notifyOnAssign={notifyOnAssign}
                  setNotifyOnAssign={setNotifyOnAssign}
                  onClearTasks={refreshFromServer}
                />
              )}
            </main>

            <TaskDetail
              task={selected}
              comments={selected ? comments[selected.id] ?? [] : []}
              activity={selected ? activity[selected.id] ?? [] : []}
              onClose={() => setSelectedId(null)}
              onChangeStatus={updateStatus}
              onChangePriority={updatePriority}
              onChangeAssignee={updateAssignee}
              onAddComment={addComment}
            />
          </div>
        </div>

        <NewTaskModal
          open={newTaskOpen}
          defaultStatus={newTaskColumn}
          members={team}
          onClose={() => setNewTaskOpen(false)}
          onCreate={createTask}
        />
      </div>
    </TaskActionsProvider>
  )
}

function CurrentUserBadge({
  user,
  isAdmin
}: {
  user: BoardAssignee
  isAdmin: boolean
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-2 py-1 ${t.btn}`}
    >
      <Avatar user={user} size={22} />
      <span className={`text-xs ${t.text} hidden sm:inline`}>{user.name}</span>
      <span
        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
          isAdmin
            ? 'bg-red-500/15 text-red-500'
            : `${t.surfaceMuted} ${t.textMuted}`
        }`}
      >
        {isAdmin ? 'Admin' : 'Member'}
      </span>
    </div>
  )
}

function ListView({
  tasks,
  onSelect
}: {
  tasks: BoardTask[]
  onSelect: (id: string) => void
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`h-full rounded-xl border overflow-hidden flex flex-col ${t.column}`}
    >
      <div
        className={`grid grid-cols-[80px_1fr_120px_140px_60px_80px] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider border-b ${t.textSubtle} ${t.columnHeader}`}
      >
        <span>Ref</span>
        <span>Title</span>
        <span>Status</span>
        <span>Assignee</span>
        <span>Prio</span>
        <span>Due</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={`w-full grid grid-cols-[80px_1fr_120px_140px_60px_80px] gap-3 px-3 py-2.5 text-xs items-center border-b text-left transition ${t.dividerSoft} ${t.rowHover}`}
          >
            <span
              className={`uppercase tracking-wider text-[10px] ${t.textSubtle}`}
            >
              {task.ref}
            </span>
            <span className={`truncate ${t.text}`}>{task.title}</span>
            <span className={t.textMuted}>
              {task.status.replace('_', ' ')}
            </span>
            <span
              className={`flex items-center gap-1.5 truncate ${t.textMuted}`}
            >
              {task.assignee ? (
                <>
                  <span
                    className={`size-4 rounded-full text-[8px] font-semibold flex items-center justify-center text-white shrink-0 ${task.assignee.color}`}
                  >
                    {task.assignee.initials}
                  </span>
                  <span className="truncate">{task.assignee.name}</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className={`capitalize ${t.textMuted}`}>{task.priority}</span>
            <span className={t.textSubtle}>{task.due ?? '—'}</span>
          </button>
        ))}
        {tasks.length === 0 && (
          <p className={`px-3 py-6 text-xs italic text-center ${t.textSubtle}`}>
            No tasks match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
