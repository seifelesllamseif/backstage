'use client'

import { CalendarRange, FileText, Loader2, Pencil, Plus } from 'lucide-react'
import type { Cycle } from './boardData'
import { useDashTheme } from './theme'

interface CycleHeroProps {
  cycle: Cycle | null
  canEdit: boolean
  onPlan: () => void
  onEdit: () => void
  copySlot?: React.ReactNode
}

function daysLeft(toIso: string): number {
  const now = new Date()
  const todayIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
  const today = new Date(todayIso.slice(0, 10) + 'T00:00:00Z').getTime()
  const to = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((to - today) / 86400000)
}

export default function CycleHero({
  cycle,
  canEdit,
  onPlan,
  onEdit,
  copySlot
}: CycleHeroProps) {
  const { t } = useDashTheme()

  if (!cycle) {
    return (
      <div
        className={`mb-3 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 ${t.border}`}
      >
        <div className="flex flex-col">
          <span className={`text-sm ${t.text}`}>No active cycle</span>
          <span className={`text-xs ${t.textMuted}`}>
            Plan a phase to give this project a focus window and a Definition of
            Done.
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onPlan}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
          >
            <Plus className="size-3.5" /> Start a cycle
          </button>
        )}
      </div>
    )
  }

  const left = daysLeft(cycle.toIso)
  const leftLabel =
    left < 0
      ? `${Math.abs(left)}d overdue`
      : left === 0
        ? 'Ends today'
        : `${left}d left`

  return (
    <div
      className={`mb-3 flex flex-col gap-3 rounded-xl border px-4 pt-3 ${t.column}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-row gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${t.metaTag}`}
            >
              <Loader2 className="size-3 animate-spin" />
              Current
            </span>
            <span className={`text-[10px] ${t.textSubtle}`}>
              #{cycle.number}
            </span>
            <h3 className={`text-sm font-medium ${t.text}`}>{cycle.name}</h3>
          </div>
          {cycle.description && (
            <p className={`text-xs leading-relaxed ${t.textMuted}`}>
              <span
                className={`mr-1 text-[10px] tracking-wider uppercase ${t.textSubtle}`}
              >
                DoD ·
              </span>
              {cycle.description}
            </p>
          )}
          <div
            className={`flex flex-wrap items-center gap-3 text-[11px] ${t.textMuted}`}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="size-3" />
              {cycle.from} → {cycle.to}
            </span>
            <span className={left < 0 ? t.accentText : t.textMuted}>
              {leftLabel}
            </span>
            <span className="tabular-nums">
              {cycle.completedCount}/{cycle.scope || 0} done
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {cycle.docUrl && (
            <a
              href={cycle.docUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="Open plan doc"
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition ${t.btn}`}
            >
              <FileText className="size-3.5" /> Doc
            </a>
          )}
          {copySlot}
          {canEdit && (
            <button
              onClick={onEdit}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition ${t.btn}`}
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className={`h-1.5 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-red-500 transition-all"
          style={{ width: `${cycle.percent}%` }}
        />
      </div>
    </div>
  )
}
