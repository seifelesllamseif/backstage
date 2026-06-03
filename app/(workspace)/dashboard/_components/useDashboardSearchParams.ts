'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { TaskPriority, TaskStatus } from './status'

export type GroupBy = 'status' | 'assignee' | 'priority' | 'lead'
export type Feed = 'all' | 'mine' | 'inbox' | 'mentions'

const FEED_VALUES: Feed[] = ['all', 'mine', 'inbox', 'mentions']

const STATUS_VALUES: TaskStatus[] = [
  'backlog',
  'unscoped',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
  'duplicate'
]
const PRIORITY_VALUES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']
const GROUP_BY_VALUES: GroupBy[] = ['status', 'assignee', 'priority', 'lead']

function parseCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseTyped<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  const set = new Set<string>(allowed)
  return parseCsv(raw).filter((v): v is T => set.has(v))
}

export interface DashboardSearchParams {
  statusFilter: TaskStatus[]
  priorityFilter: TaskPriority[]
  assigneeFilter: string[]
  leadFilter: string[]
  tagFilter: string[]
  sprintFilter: string[]
  query: string
  groupBy: GroupBy
  feed: Feed

  setStatusFilter: (next: TaskStatus[]) => void
  toggleStatus: (s: TaskStatus) => void
  clearStatus: () => void

  setPriorityFilter: (next: TaskPriority[]) => void
  togglePriority: (p: TaskPriority) => void
  clearPriority: () => void

  setAssigneeFilter: (next: string[]) => void
  toggleAssignee: (id: string) => void
  clearAssignee: () => void

  setLeadFilter: (next: string[]) => void
  toggleLead: (id: string) => void
  clearLead: () => void

  setTagFilter: (next: string[]) => void
  toggleTag: (tag: string) => void
  clearTag: () => void

  setSprintFilter: (next: string[]) => void
  toggleSprint: (id: string) => void
  clearSprint: () => void

  setQuery: (q: string) => void
  setGroupBy: (g: GroupBy) => void
  setFeed: (f: Feed) => void

  resetFilters: () => void

  // Apply multiple filter changes in a single URL update. Per-filter
  // setters each call router.replace, so calling them back-to-back in one
  // event handler causes them to overwrite each other (each reads the
  // stale URL). Use this for any flow that updates multiple axes at once
  // (e.g., quick-filter chips).
  applyFilters: (next: {
    status?: TaskStatus[]
    priority?: TaskPriority[]
    assignee?: string[]
    lead?: string[]
    tag?: string[]
    sprint?: string[]
    query?: string
    groupBy?: GroupBy
  }) => void
}

// Optional members list so the hook can translate human-readable slugs
// in ?assignee= back to UUIDs (and vice versa). When omitted, the
// assignee filter works on raw values like before.
export interface UseDashboardSearchParamsOptions {
  members?: { id: string; slug?: string | null }[]
}

export function useDashboardSearchParams(
  opts: UseDashboardSearchParamsOptions = {}
): DashboardSearchParams {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const members = opts.members
  // Two-way maps. Built once per members change and only used to
  // serialise/deserialise the assignee filter.
  const slugById = useMemo(() => {
    const m = new Map<string, string>()
    if (!members) return m
    for (const x of members) if (x.slug) m.set(x.id, x.slug)
    return m
  }, [members])
  const idBySlug = useMemo(() => {
    const m = new Map<string, string>()
    if (!members) return m
    for (const x of members) if (x.slug) m.set(x.slug, x.id)
    return m
  }, [members])

  const statusFilter = useMemo(
    () => parseTyped<TaskStatus>(searchParams.get('status'), STATUS_VALUES),
    [searchParams]
  )
  const priorityFilter = useMemo(
    () => parseTyped<TaskPriority>(searchParams.get('priority'), PRIORITY_VALUES),
    [searchParams]
  )
  // URL tokens can be either slugs or UUIDs - normalise to UUIDs so the
  // rest of the dashboard (which keys off task.assignee.id) doesn't care.
  // Unknown tokens pass through unchanged.
  const assigneeFilter = useMemo(
    () =>
      parseCsv(searchParams.get('assignee')).map(
        (token) => idBySlug.get(token) ?? token
      ),
    [searchParams, idBySlug]
  )
  // Lead filter mirrors assignee: same slug-to-id translation, same
  // multi-select semantics, just a different field on the task.
  const leadFilter = useMemo(
    () =>
      parseCsv(searchParams.get('lead')).map(
        (token) => idBySlug.get(token) ?? token
      ),
    [searchParams, idBySlug]
  )
  const tagFilter = useMemo(
    () => parseCsv(searchParams.get('tag')),
    [searchParams]
  )
  const sprintFilter = useMemo(
    () => parseCsv(searchParams.get('sprint')),
    [searchParams]
  )
  const query = searchParams.get('q') ?? ''
  const groupBy: GroupBy = (() => {
    const raw = searchParams.get('group')
    return GROUP_BY_VALUES.includes(raw as GroupBy) ? (raw as GroupBy) : 'status'
  })()
  const feed: Feed = (() => {
    const raw = searchParams.get('feed')
    return FEED_VALUES.includes(raw as Feed) ? (raw as Feed) : 'all'
  })()

  // Sidebar panel routes don't render the task list, so applying a filter
  // while sitting on one of these would just update the URL without any
  // visible effect. Route the filter write to /dashboard/board instead so
  // the user actually sees the filtered task list.
  const PANEL_ROUTES = new Set([
    '/dashboard/projects',
    '/dashboard/updates',
    '/dashboard/symbols',
    '/dashboard/settings',
    '/dashboard/team',
    '/dashboard/archive'
  ])
  const resolveDest = useCallback(
    (path: string): { dest: string; navigated: boolean } => {
      if (PANEL_ROUTES.has(path)) {
        return { dest: '/dashboard/board', navigated: true }
      }
      return { dest: path, navigated: false }
    },
    []
  )
  const goWithParams = useCallback(
    (qs: string) => {
      const { dest, navigated } = resolveDest(pathname ?? '')
      const url = qs ? `${dest}?${qs}` : dest
      if (navigated) {
        // Jumping out of a panel into the board - push so the user can
        // back-button to the panel they came from.
        router.push(url)
      } else {
        // Same surface, just a filter tweak - replace to keep history clean.
        router.replace(url, { scroll: false })
      }
    },
    [pathname, resolveDest, router]
  )

  const writeParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === null || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      goWithParams(next.toString())
    },
    [goWithParams, searchParams]
  )

  const writeCsv = useCallback(
    (key: string, values: string[]) => {
      writeParam(key, values.length === 0 ? null : values.join(','))
    },
    [writeParam]
  )

  const setStatusFilter = useCallback(
    (next: TaskStatus[]) => writeCsv('status', next),
    [writeCsv]
  )
  const toggleStatus = useCallback(
    (s: TaskStatus) =>
      setStatusFilter(
        statusFilter.includes(s)
          ? statusFilter.filter((x) => x !== s)
          : [...statusFilter, s]
      ),
    [setStatusFilter, statusFilter]
  )
  const clearStatus = useCallback(() => writeCsv('status', []), [writeCsv])

  const setPriorityFilter = useCallback(
    (next: TaskPriority[]) => writeCsv('priority', next),
    [writeCsv]
  )
  const togglePriority = useCallback(
    (p: TaskPriority) =>
      setPriorityFilter(
        priorityFilter.includes(p)
          ? priorityFilter.filter((x) => x !== p)
          : [...priorityFilter, p]
      ),
    [setPriorityFilter, priorityFilter]
  )
  const clearPriority = useCallback(() => writeCsv('priority', []), [writeCsv])

  // Translate UUIDs to slugs before serialising so the URL stays readable.
  // Unknown ids (members not in `opts.members` yet) pass through.
  const serialiseAssignees = useCallback(
    (uuids: string[]) => uuids.map((id) => slugById.get(id) ?? id),
    [slugById]
  )
  const setAssigneeFilter = useCallback(
    (next: string[]) => writeCsv('assignee', serialiseAssignees(next)),
    [writeCsv, serialiseAssignees]
  )
  const toggleAssignee = useCallback(
    (id: string) =>
      setAssigneeFilter(
        assigneeFilter.includes(id)
          ? assigneeFilter.filter((x) => x !== id)
          : [...assigneeFilter, id]
      ),
    [setAssigneeFilter, assigneeFilter]
  )
  const clearAssignee = useCallback(() => writeCsv('assignee', []), [writeCsv])

  const setLeadFilter = useCallback(
    (next: string[]) => writeCsv('lead', serialiseAssignees(next)),
    [writeCsv, serialiseAssignees]
  )
  const toggleLead = useCallback(
    (id: string) =>
      setLeadFilter(
        leadFilter.includes(id)
          ? leadFilter.filter((x) => x !== id)
          : [...leadFilter, id]
      ),
    [setLeadFilter, leadFilter]
  )
  const clearLead = useCallback(() => writeCsv('lead', []), [writeCsv])

  const setTagFilter = useCallback(
    (next: string[]) => writeCsv('tag', next),
    [writeCsv]
  )
  const toggleTag = useCallback(
    (tag: string) =>
      setTagFilter(
        tagFilter.includes(tag)
          ? tagFilter.filter((x) => x !== tag)
          : [...tagFilter, tag]
      ),
    [setTagFilter, tagFilter]
  )
  const clearTag = useCallback(() => writeCsv('tag', []), [writeCsv])

  const setSprintFilter = useCallback(
    (next: string[]) => writeCsv('sprint', next),
    [writeCsv]
  )
  const toggleSprint = useCallback(
    (id: string) =>
      setSprintFilter(
        sprintFilter.includes(id)
          ? sprintFilter.filter((x) => x !== id)
          : [...sprintFilter, id]
      ),
    [setSprintFilter, sprintFilter]
  )
  const clearSprint = useCallback(() => writeCsv('sprint', []), [writeCsv])

  const setQuery = useCallback(
    (q: string) => writeParam('q', q.trim() === '' ? null : q),
    [writeParam]
  )

  const setGroupBy = useCallback(
    (g: GroupBy) => writeParam('group', g === 'status' ? null : g),
    [writeParam]
  )

  const setFeed = useCallback(
    (f: Feed) => writeParam('feed', f === 'all' ? null : f),
    [writeParam]
  )

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('status')
    next.delete('priority')
    next.delete('assignee')
    next.delete('lead')
    next.delete('tag')
    next.delete('sprint')
    next.delete('q')
    goWithParams(next.toString())
  }, [goWithParams, searchParams])

  const applyFilters = useCallback(
    (updates: {
      status?: TaskStatus[]
      priority?: TaskPriority[]
      assignee?: string[]
      lead?: string[]
      tag?: string[]
      sprint?: string[]
      query?: string
      groupBy?: GroupBy
    }) => {
      const next = new URLSearchParams(searchParams.toString())
      const writeCsvKey = (key: string, values?: string[]) => {
        if (values === undefined) return
        if (values.length === 0) next.delete(key)
        else next.set(key, values.join(','))
      }
      writeCsvKey('status', updates.status)
      writeCsvKey('priority', updates.priority)
      // assignee values come in as UUIDs; serialise to slugs for the URL.
      writeCsvKey(
        'assignee',
        updates.assignee ? serialiseAssignees(updates.assignee) : undefined
      )
      writeCsvKey(
        'lead',
        updates.lead ? serialiseAssignees(updates.lead) : undefined
      )
      writeCsvKey('tag', updates.tag)
      writeCsvKey('sprint', updates.sprint)
      if (updates.query !== undefined) {
        const q = updates.query.trim()
        if (q === '') next.delete('q')
        else next.set('q', q)
      }
      if (updates.groupBy !== undefined) {
        if (updates.groupBy === 'status') next.delete('group')
        else next.set('group', updates.groupBy)
      }
      goWithParams(next.toString())
    },
    [goWithParams, searchParams, serialiseAssignees]
  )

  return {
    statusFilter,
    priorityFilter,
    assigneeFilter,
    leadFilter,
    tagFilter,
    sprintFilter,
    query,
    groupBy,
    feed,
    setStatusFilter,
    toggleStatus,
    clearStatus,
    setPriorityFilter,
    togglePriority,
    clearPriority,
    setAssigneeFilter,
    toggleAssignee,
    clearAssignee,
    setLeadFilter,
    toggleLead,
    clearLead,
    setTagFilter,
    toggleTag,
    clearTag,
    setSprintFilter,
    toggleSprint,
    clearSprint,
    setQuery,
    setGroupBy,
    setFeed,
    resetFilters,
    applyFilters
  }
}
