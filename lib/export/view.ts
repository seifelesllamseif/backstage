// Serialize an arbitrary set of tasks (a "view") to markdown or JSON.
// Used by the Copy view button on the Topbar. Honors time scopes by
// pre-filtering the task list before handing it here.

import { STATUSES } from '@/app/(workspace)/dashboard/_components/status'
import { taskToJsonObject, taskToMarkdown } from './task'
import type { ExportContext, ExportOptions } from './types'
import { EXPORT_VERSION } from './types'
import type { BoardTask } from '@/app/(workspace)/dashboard/_components/boardData'

export interface ViewMeta {
  // Free-form title for the heading (e.g. "All tasks", "Mine - this week",
  // "Phase 2 sprint").
  title: string
  // How tasks should be grouped in the markdown output. JSON ignores this.
  groupBy?: 'status' | 'priority' | 'sprint' | 'assignee' | 'none'
  // Optional time scope name shown in the markdown header.
  scopeLabel?: string
}

export function viewToMarkdown(
  tasks: BoardTask[],
  ctx: ExportContext,
  meta: ViewMeta,
  options: ExportOptions = {}
): string {
  const lines: string[] = []
  lines.push(`# ${meta.title}`)
  lines.push('')
  lines.push(`- **Exported at:** ${new Date().toISOString()}`)
  lines.push(`- **Task count:** ${tasks.length}`)
  if (meta.scopeLabel) lines.push(`- **Scope:** ${meta.scopeLabel}`)
  if (meta.groupBy && meta.groupBy !== 'none') {
    lines.push(`- **Grouped by:** ${meta.groupBy}`)
  }

  if (tasks.length === 0) {
    lines.push('')
    lines.push('_(no tasks in this scope)_')
    return lines.join('\n') + '\n'
  }

  const grouping = meta.groupBy ?? 'status'

  const renderTask = (task: BoardTask) => {
    lines.push('')
    lines.push('---')
    lines.push('')
    const md = taskToMarkdown(task, ctx, options).replace(/^# /, '### ')
    lines.push(md.trim())
  }

  if (grouping === 'status') {
    for (const s of STATUSES) {
      const inGroup = tasks.filter((t) => t.status === s.id)
      if (inGroup.length === 0) continue
      lines.push('')
      lines.push(`## ${s.label} (${inGroup.length})`)
      for (const task of inGroup) renderTask(task)
    }
  } else if (grouping === 'priority') {
    const order: BoardTask['priority'][] = [
      'urgent',
      'high',
      'medium',
      'low',
      'none',
    ]
    for (const p of order) {
      const inGroup = tasks.filter((t) => t.priority === p)
      if (inGroup.length === 0) continue
      lines.push('')
      lines.push(`## Priority: ${p} (${inGroup.length})`)
      for (const task of inGroup) renderTask(task)
    }
  } else if (grouping === 'assignee') {
    const byId = new Map<string, BoardTask[]>()
    for (const task of tasks) {
      const key = task.assignee?.id ?? '__unassigned__'
      const list = byId.get(key) ?? []
      list.push(task)
      byId.set(key, list)
    }
    for (const [key, list] of byId) {
      const name =
        key === '__unassigned__'
          ? 'Unassigned'
          : list[0]?.assignee?.name ?? key
      lines.push('')
      lines.push(`## ${name} (${list.length})`)
      for (const task of list) renderTask(task)
    }
  } else if (grouping === 'sprint') {
    const bySprint = new Map<string, BoardTask[]>()
    const unscheduled: BoardTask[] = []
    for (const task of tasks) {
      const sprint = ctx.sprints.find((c) => c.taskIds.includes(task.id))
      if (!sprint) {
        unscheduled.push(task)
        continue
      }
      const list = bySprint.get(sprint.id) ?? []
      list.push(task)
      bySprint.set(sprint.id, list)
    }
    for (const sprint of ctx.sprints) {
      const list = bySprint.get(sprint.id)
      if (!list || list.length === 0) continue
      lines.push('')
      lines.push(`## ${sprint.name} (${sprint.status}) - ${list.length} tasks`)
      for (const task of list) renderTask(task)
    }
    if (unscheduled.length > 0) {
      lines.push('')
      lines.push(`## Unscheduled (${unscheduled.length})`)
      for (const task of unscheduled) renderTask(task)
    }
  } else {
    // 'none' - flat list
    for (const task of tasks) renderTask(task)
  }

  return lines.join('\n') + '\n'
}

export function viewToJson(
  tasks: BoardTask[],
  ctx: ExportContext,
  meta: ViewMeta,
  options: ExportOptions = {}
): string {
  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'view',
      exportedAt: new Date().toISOString(),
      view: {
        title: meta.title,
        groupBy: meta.groupBy ?? 'status',
        scopeLabel: meta.scopeLabel ?? null,
        taskCount: tasks.length,
      },
      tasks: tasks.map((t) => taskToJsonObject(t, ctx, options)),
    },
    null,
    2
  )
}
