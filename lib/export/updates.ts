// Serialize the activity feed (the Updates panel) to markdown or JSON.
// Caller pre-filters the activity rows by scope; this just formats them.

import { EXPORT_VERSION } from './types'

export interface UpdateRow {
  id: string
  kind: 'status' | 'comment' | 'attachment' | 'created' | 'priority' | 'assignee'
  text: string
  at: string
  atRaw: string
  taskId: string
  taskRef: string | null
  taskTitle: string | null
}

export interface UpdatesMeta {
  title: string
  scopeLabel?: string
}

export function updatesToMarkdown(
  rows: UpdateRow[],
  meta: UpdatesMeta
): string {
  const lines: string[] = []
  lines.push(`# ${meta.title}`)
  lines.push('')
  lines.push(`- **Exported at:** ${new Date().toISOString()}`)
  lines.push(`- **Update count:** ${rows.length}`)
  if (meta.scopeLabel) lines.push(`- **Scope:** ${meta.scopeLabel}`)
  lines.push('')

  if (rows.length === 0) {
    lines.push('_(no updates in this scope)_')
    return lines.join('\n') + '\n'
  }

  // Group by day for legibility.
  const byDay = new Map<string, UpdateRow[]>()
  for (const row of rows) {
    const day = (row.atRaw || '').slice(0, 10) || 'unknown'
    const list = byDay.get(day) ?? []
    list.push(row)
    byDay.set(day, list)
  }
  // Newest day first.
  const days = [...byDay.keys()].sort().reverse()
  for (const day of days) {
    lines.push(`## ${day}`)
    const list = byDay.get(day) ?? []
    for (const row of list) {
      const refPart = row.taskRef ? `[${row.taskRef}] ` : ''
      const title = row.taskTitle ? ` (${row.taskTitle})` : ''
      lines.push(`- **${row.at}** - ${refPart}${row.text}${title}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function updatesToJson(
  rows: UpdateRow[],
  meta: UpdatesMeta
): string {
  return JSON.stringify(
    {
      version: EXPORT_VERSION,
      kind: 'updates',
      exportedAt: new Date().toISOString(),
      meta: {
        title: meta.title,
        scopeLabel: meta.scopeLabel ?? null,
        count: rows.length,
      },
      updates: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        text: r.text,
        at: r.at,
        atRaw: r.atRaw,
        task: {
          id: r.taskId,
          ref: r.taskRef,
          title: r.taskTitle,
        },
      })),
    },
    null,
    2
  )
}
