// Serialize a project to markdown or JSON. Includes all tasks, all cycles,
// and the project-level external refs.

import { STATUSES, STATUS_BY_ID } from '@/app/(workspace)/dashboard/_components/status'
import {
  defaultExternalRefLabel,
  parseExternalRef,
} from '@/lib/externalRef'
import { taskToJsonObject, taskToMarkdown } from './task'
import type { ExportContext, ExportOptions, ProjectLite } from './types'
import { EXPORT_VERSION } from './types'

export function projectToMarkdown(
  project: ProjectLite,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const lines: string[] = []
  const tasks = ctx.tasks.filter((task) => task.projectId === project.id)
  const cycles = ctx.cycles.filter((c) => c.projectId === project.id)
  const projectRefs = ctx.refsByProject[project.id] ?? []
  const done = tasks.filter((t) => t.status === 'done').length

  lines.push(`# Project: ${project.name}`)
  lines.push('')
  lines.push(`- **Kind:** ${project.kind}`)
  if (project.isArchived) lines.push(`- **Archived:** yes`)
  if (project.githubRepo) {
    lines.push(`- **GitHub repo:** ${project.githubRepo}`)
  }
  lines.push(
    `- **Tasks:** ${done}/${tasks.length} done (${tasks.length} total)`
  )
  lines.push(`- **Cycles:** ${cycles.length}`)

  if (projectRefs.length > 0) {
    lines.push('')
    lines.push('## Links')
    for (const ref of projectRefs) {
      const parsed = parseExternalRef(ref.url)
      const label = ref.label ?? (parsed ? defaultExternalRefLabel(parsed) : ref.url)
      lines.push(`- ${ref.kind}: [${label}](${ref.url})`)
    }
  }

  if (cycles.length > 0) {
    lines.push('')
    lines.push('## Cycles')
    // Same sort order as the Cycles tab: current, then upcoming asc, then
    // completed (newest first).
    const order: Record<typeof cycles[number]['status'], number> = {
      current: 0,
      upcoming: 1,
      completed: 2,
    }
    const sorted = [...cycles].sort((a, b) => {
      const so = order[a.status] - order[b.status]
      if (so !== 0) return so
      if (a.status === 'completed') return b.number - a.number
      return a.number - b.number
    })
    for (const c of sorted) {
      lines.push('')
      lines.push(`### ${c.name} (${c.status})`)
      lines.push(`- ${c.from} to ${c.to}`)
      if (c.description) lines.push(`- DoD: ${c.description}`)
      if (c.docUrl) lines.push(`- Plan doc: ${c.docUrl}`)
      lines.push(
        `- Progress: ${c.completedCount}/${c.scope || 0} done (${c.percent}%)`
      )
    }
  }

  if (tasks.length > 0) {
    lines.push('')
    lines.push('## Tasks')
    for (const s of STATUSES) {
      const inStatus = tasks.filter((t) => t.status === s.id)
      if (inStatus.length === 0) continue
      lines.push('')
      lines.push(`### ${s.label} (${inStatus.length})`)
      for (const task of inStatus) {
        lines.push('')
        lines.push('---')
        lines.push('')
        // Demote h1 to h4 so the project keeps top-level structure.
        const md = taskToMarkdown(task, ctx, options).replace(/^# /, '#### ')
        lines.push(md.trim())
      }
    }
  }

  return lines.join('\n') + '\n'
}

export function projectToJson(
  project: ProjectLite,
  ctx: ExportContext,
  options: ExportOptions = {}
): string {
  const tasks = ctx.tasks.filter((task) => task.projectId === project.id)
  const cycles = ctx.cycles.filter((c) => c.projectId === project.id)
  const projectRefs = ctx.refsByProject[project.id] ?? []

  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'project',
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        kind: project.kind,
        isArchived: project.isArchived,
        githubRepo: project.githubRepo,
        links: projectRefs.map((r) => ({
          id: r.id,
          kind: r.kind,
          url: r.url,
          label: r.label,
        })),
      },
      stats: {
        tasksTotal: tasks.length,
        tasksDone: tasks.filter((t) => t.status === 'done').length,
        byStatus: STATUSES.reduce<Record<string, number>>((acc, s) => {
          acc[s.id] = tasks.filter((t) => t.status === s.id).length
          return acc
        }, {}),
        cyclesTotal: cycles.length,
      },
      cycles: cycles.map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name,
        description: c.description,
        docUrl: c.docUrl,
        status: c.status,
        from: c.fromIso,
        to: c.toIso,
        scope: c.scope,
        completedCount: c.completedCount,
        startedCount: c.startedCount,
        percent: c.percent,
        taskIds: c.taskIds,
      })),
      tasks: tasks.map((t) => taskToJsonObject(t, ctx, options)),
    },
    null,
    2
  )
}

// Suppress an unused import warning if STATUS_BY_ID is not referenced
// directly above.
void STATUS_BY_ID
