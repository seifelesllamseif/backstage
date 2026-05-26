// Serialize a single task to markdown or JSON. Used by the Copy task
// button on the task detail panel and also reused by the view + project
// + cycle exporters when they include nested tasks.

import {
  defaultExternalRefLabel,
  parseExternalRef,
} from '@/lib/externalRef'
import { PRIORITY_LABEL, STATUS_BY_ID } from '@/app/(workspace)/dashboard/_components/status'
import type {
  ExportContext,
  ExportOptions,
} from './types'
import { EXPORT_VERSION } from './types'
import type { BoardTask } from '@/app/(workspace)/dashboard/_components/boardData'

function findCycleForTask(taskId: string, ctx: ExportContext) {
  return ctx.cycles.find((c) => c.taskIds.includes(taskId)) ?? null
}

function findProjectForTask(task: BoardTask, ctx: ExportContext) {
  if (!task.projectId) return null
  return ctx.projects.find((p) => p.id === task.projectId) ?? null
}

export function taskToMarkdown(
  task: BoardTask,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const lines: string[] = []
  const status = STATUS_BY_ID[task.status]?.label ?? task.status
  const priority = PRIORITY_LABEL[task.priority] ?? task.priority
  const project = findProjectForTask(task, ctx)
  const cycle = findCycleForTask(task.id, ctx)

  lines.push(`# [${task.ref}] ${task.title}`)
  lines.push('')
  lines.push(`- **Status:** ${status}`)
  lines.push(`- **Priority:** ${priority}`)
  if (task.assignee) lines.push(`- **Assignee:** ${task.assignee.name}`)
  else lines.push(`- **Assignee:** unassigned`)
  if (project) {
    const repo = project.githubRepo ? ` (${project.githubRepo})` : ''
    lines.push(`- **Project:** ${project.name}${repo}`)
  }
  if (cycle) {
    lines.push(`- **Cycle:** ${cycle.name} (${cycle.status})`)
  }
  if (task.due) lines.push(`- **Due:** ${task.due}`)
  if (task.tags && task.tags.length > 0) {
    lines.push(`- **Labels:** ${task.tags.join(', ')}`)
  }
  lines.push(`- **Created:** ${task.createdAt}`)
  lines.push(`- **Updated:** ${task.updatedAt}`)

  if (task.checklist && task.checklist.length > 0) {
    lines.push('')
    lines.push('## Checklist')
    for (const item of task.checklist) {
      lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`)
    }
  }

  if (task.relations && task.relations.length > 0) {
    lines.push('')
    lines.push('## Relations')
    for (const rel of task.relations) {
      lines.push(`- ${rel.kind}: ${rel.ref}`)
    }
  }

  const refs = ctx.refsByTask[task.id] ?? []
  if (refs.length > 0) {
    lines.push('')
    lines.push('## Links')
    for (const ref of refs) {
      const parsed = parseExternalRef(ref.url)
      const label = ref.label ?? (parsed ? defaultExternalRefLabel(parsed) : ref.url)
      lines.push(`- ${ref.kind}: [${label}](${ref.url})`)
    }
  }

  if (!options.withoutCommentsAndActivity) {
    const comments = ctx.commentsByTask[task.id] ?? []
    if (comments.length > 0) {
      lines.push('')
      lines.push('## Comments')
      for (const c of comments) {
        lines.push('')
        const edited = c.editedAt ? ' (edited)' : ''
        lines.push(`**${c.author}** (${c.at})${edited}:`)
        lines.push('')
        lines.push(c.body)
      }
    }

    const activity = ctx.activityByTask[task.id] ?? []
    if (activity.length > 0) {
      lines.push('')
      lines.push('## Activity')
      for (const a of activity) {
        lines.push(`- ${a.at}: ${a.text}`)
      }
    }
  }

  return lines.join('\n') + '\n'
}

export function taskToJsonObject(
  task: BoardTask,
  ctx: ExportContext,
  options: ExportOptions = {}
): Record<string, unknown> {
  const project = findProjectForTask(task, ctx)
  const cycle = findCycleForTask(task.id, ctx)
  const refs = ctx.refsByTask[task.id] ?? []
  const comments = ctx.commentsByTask[task.id] ?? []
  const activity = ctx.activityByTask[task.id] ?? []

  const obj: Record<string, unknown> = {
    id: task.id,
    ref: task.ref,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name }
      : null,
    project: project
      ? { id: project.id, name: project.name, githubRepo: project.githubRepo }
      : null,
    cycle: cycle
      ? { id: cycle.id, name: cycle.name, status: cycle.status }
      : null,
    due: task.due ?? null,
    dueAt: task.dueAt ?? null,
    labels: task.tags ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    checklist: task.checklist ?? [],
    relations: task.relations ?? [],
    links: refs.map((r) => ({
      id: r.id,
      kind: r.kind,
      url: r.url,
      label: r.label,
    })),
  }

  if (!options.withoutCommentsAndActivity) {
    obj.comments = comments.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.body,
      at: c.at,
      editedAt: c.editedAt ?? null,
    }))
    obj.activity = activity.map((a) => ({
      id: a.id,
      kind: a.kind,
      text: a.text,
      at: a.at,
      atRaw: a.atRaw,
    }))
  }

  return obj
}

export function taskToJson(
  task: BoardTask,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'task',
      exportedAt: new Date().toISOString(),
      task: taskToJsonObject(task, ctx, options),
    },
    null,
    2
  )
}
