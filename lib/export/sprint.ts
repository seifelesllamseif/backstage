// Serialize a single sprint (phase) to markdown or JSON.

import type { Sprint } from '@/app/(workspace)/dashboard/_components/boardData'
import { taskToJsonObject, taskToMarkdown } from './task'
import type { ExportContext, ExportOptions } from './types'
import { EXPORT_VERSION } from './types'

function sprintHeader(sprint: Sprint): string[] {
  const lines: string[] = []
  lines.push(`# Sprint: ${sprint.name}`)
  lines.push('')
  lines.push(`- **Number:** ${sprint.number}`)
  lines.push(`- **Status:** ${sprint.status}`)
  lines.push(`- **Range:** ${sprint.from} to ${sprint.to}`)
  lines.push(
    `- **Progress:** ${sprint.completedCount}/${sprint.scope || 0} done (${sprint.percent}%)`
  )
  if (sprint.description) {
    lines.push('')
    lines.push('## Definition of Done')
    lines.push('')
    lines.push(sprint.description)
  }
  if (sprint.docUrl) {
    lines.push('')
    lines.push(`Plan doc: ${sprint.docUrl}`)
  }
  return lines
}

export function sprintToMarkdown(
  sprint: Sprint,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const lines: string[] = sprintHeader(sprint)
  const tasks = ctx.tasks.filter((task) => sprint.taskIds.includes(task.id))
  if (tasks.length > 0) {
    lines.push('')
    lines.push('## Tasks')
    for (const task of tasks) {
      lines.push('')
      lines.push('---')
      lines.push('')
      // Demote h1 to h2 so the sprint stays the top-level heading.
      const md = taskToMarkdown(task, ctx, options).replace(/^# /, '## ')
      lines.push(md.trim())
    }
  }
  return lines.join('\n') + '\n'
}

export function sprintToJson(
  sprint: Sprint,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const tasks = ctx.tasks.filter((task) => sprint.taskIds.includes(task.id))
  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'sprint',
      exportedAt: new Date().toISOString(),
      sprint: {
        id: sprint.id,
        projectId: sprint.projectId,
        number: sprint.number,
        name: sprint.name,
        description: sprint.description,
        docUrl: sprint.docUrl,
        status: sprint.status,
        from: sprint.fromIso,
        to: sprint.toIso,
        scope: sprint.scope,
        completedCount: sprint.completedCount,
        startedCount: sprint.startedCount,
        percent: sprint.percent,
      },
      tasks: tasks.map((t) => taskToJsonObject(t, ctx, options)),
    },
    null,
    2
  )
}
