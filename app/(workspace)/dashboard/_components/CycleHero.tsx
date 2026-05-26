'use client'

import { CalendarRange, FileText, Loader2, Pencil, Plus } from 'lucide-react'
import type { Cycle } from './boardData'
import { useDashTheme } from './theme'

// Hero card that sits above the board when the in-scope project has an
// active sprint. Renamed from "cycle" everywhere in copy; the underlying
// model still uses Cycle / cycleId for backward compatibility.

interface CycleHeroProps {
  cycle: Cycle | null
  canEdit: boolean
  onPlan: () => void
  onEdit: () => void
  copySlot?: React.ReactNode
}

function daysLeft(toIso: string): number {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).getTime()
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
        className={`mb-2 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 ${t.border}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className={`text-[13px] font-medium ${t.text}`}>
            No active sprint
          </span>
          <span className={`text-[11px] ${t.textMuted}`}>
            Plan a sprint to give this project a focus window and a Definition
            of Done.
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onPlan}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] transition ${t.accent}`}
          >
            <Plus className="size-3" /> Start a sprint
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
  const leftClass = left < 0 ? t.accentText : t.textMuted

  return (
    <div
      className={`mb-2 flex flex-col gap-2 rounded-lg border px-3 py-2 ${t.column}`}
    >
      {/* Row 1: identity (left) + actions (right). */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase ${t.metaTag}`}
            >
              <Loader2 className="size-2.5 animate-spin" />
              Current sprint
            </span>
            <span className={`text-[10px] tabular-nums ${t.textSubtle}`}>
              #{cycle.number}
            </span>
          </div>
          <h3
            className={`truncate text-[13px] leading-tight font-medium ${t.text}`}
          >
            {cycle.name}
          </h3>
          {cycle.description && (
            <p className={`text-[11px] leading-snug ${t.textMuted}`}>
              <span
                className={`mr-1 text-[9px] tracking-wider uppercase ${t.textSubtle}`}
              >
                DoD
              </span>
              {cycle.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {cycle.docUrl && (
            <a
              href={cycle.docUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="Open plan doc"
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${t.btn}`}
            >
              <FileText className="size-3" />
              <span className="hidden sm:inline">Doc</span>
            </a>
          )}
          {copySlot}
          {canEdit && (
            <button
              onClick={onEdit}
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${t.btn}`}
            >
              <Pencil className="size-3" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: meta strip — dates, days-left, progress count, percent. */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t pt-1.5 text-[10px] ${t.border}`}
      >
        <span className={`inline-flex items-center gap-1 ${t.textMuted}`}>
          <CalendarRange className="size-2.5" />
          {cycle.from} → {cycle.to}
        </span>
        <span className={leftClass}>{leftLabel}</span>
        <span className={`tabular-nums ${t.textMuted}`}>
          {cycle.completedCount}/{cycle.scope || 0} done
        </span>
        <span className={`ml-auto tabular-nums ${t.textSubtle}`}>
          {cycle.percent}%
        </span>
      </div>

      {/* Row 3: progress bar */}
      <div className={`h-1 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${cycle.percent}%` }}
        />
      </div>
    </div>
  )
}
