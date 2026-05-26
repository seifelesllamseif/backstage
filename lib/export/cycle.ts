// Serialize a single cycle (phase) to markdown or JSON.

import type { Cycle } from '@/app/(workspace)/dashboard/_components/boardData'
import { taskToJsonObject, taskToMarkdown } from './task'
import type { ExportContext, ExportOptions } from './types'
import { EXPORT_VERSION } from './types'

function cycleHeader(cycle: Cycle): string[] {
  const lines: string[] = []
  lines.push(`# Sprint: ${cycle.name}`)
  lines.push('')
  lines.push(`- **Number:** ${cycle.number}`)
  lines.push(`- **Status:** ${cycle.status}`)
  lines.push(`- **Range:** ${cycle.from} to ${cycle.to}`)
  lines.push(
    `- **Progress:** ${cycle.completedCount}/${cycle.scope || 0} done (${cycle.percent}%)`
  )
  if (cycle.description) {
    lines.push('')
    lines.push('## Definition of Done')
    lines.push('')
    lines.push(cycle.description)
  }
  if (cycle.docUrl) {
    lines.push('')
    lines.push(`Plan doc: ${cycle.docUrl}`)
  }
  return lines
}

export function cycleToMarkdown(
  cycle: Cycle,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const lines: string[] = cycleHeader(cycle)
  const tasks = ctx.tasks.filter((task) => cycle.taskIds.includes(task.id))
  if (tasks.length > 0) {
    lines.push('')
    lines.push('## Tasks')
    for (const task of tasks) {
      lines.push('')
      lines.push('---')
      lines.push('')
      // Demote h1 to h2 so the cycle stays the top-level heading.
      const md = taskToMarkdown(task, ctx, options).replace(/^# /, '## ')
      lines.push(md.trim())
    }
  }
  return lines.join('\n') + '\n'
}

export function cycleToJson(
  cycle: Cycle,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const tasks = ctx.tasks.filter((task) => cycle.taskIds.includes(task.id))
  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'cycle',
      exportedAt: new Date().toISOString(),
      cycle: {
        id: cycle.id,
        projectId: cycle.projectId,
        number: cycle.number,
        name: cycle.name,
        description: cycle.description,
        docUrl: cycle.docUrl,
        status: cycle.status,
        from: cycle.fromIso,
        to: cycle.toIso,
        scope: cycle.scope,
        completedCount: cycle.completedCount,
        startedCount: cycle.startedCount,
        percent: cycle.percent,
      },
      tasks: tasks.map((t) => taskToJsonObject(t, ctx, options)),
    },
    null,
    2
  )
}
