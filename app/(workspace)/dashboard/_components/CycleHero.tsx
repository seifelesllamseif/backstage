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
        className={`mb-3 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 ${t.border}`}
      >
        <div className="flex flex-col gap-0.5">
          <span className={`text-sm font-medium ${t.text}`}>
            No active sprint
          </span>
          <span className={`text-xs ${t.textMuted}`}>
            Plan a sprint to give this project a focus window and a Definition
            of Done.
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onPlan}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
          >
            <Plus className="size-3.5" /> Start a sprint
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
      className={`mb-3 flex flex-col gap-3 rounded-xl border px-4 py-3 ${t.column}`}
    >
      {/* Row 1: identity (left) + actions (right). */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase ${t.metaTag}`}
            >
              <Loader2 className="size-3 animate-spin" />
              Current sprint
            </span>
            <span className={`text-[11px] tabular-nums ${t.textSubtle}`}>
              #{cycle.number}
            </span>
          </div>
          <h3
            className={`truncate text-base leading-tight font-medium ${t.text}`}
          >
            {cycle.name}
          </h3>
          {cycle.description && (
            <p className={`text-xs leading-relaxed ${t.textMuted}`}>
              <span
                className={`mr-1 text-[10px] tracking-wider uppercase ${t.textSubtle}`}
              >
                DoD
              </span>
              {cycle.description}
            </p>
          )}
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
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">Doc</span>
            </a>
          )}
          {copySlot}
          {canEdit && (
            <button
              onClick={onEdit}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition ${t.btn}`}
            >
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>
      {/* Row 2: meta. Separated from the title row so dates + progress
          aren't crammed against the name and the type hierarchy reads
          clean (chip / title / DoD then meta). */}
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-[11px] ${t.border}`}
      >
        <span className={`inline-flex items-center gap-1.5 ${t.textMuted}`}>
          <CalendarRange className="size-3" />
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
      <div class="mb-3 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-loader-circle size-3 animate-spin"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Current sprint
              </span>
              <span class="text-[11px] text-zinc-400 tabular-nums">#11</span>
            </div>
            <h3 class="truncate text-base leading-tight font-medium text-zinc-900">
              test
            </h3>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <div class="relative inline-flex">
              <div class="bg-secondary text-secondary-foreground flex rounded-md shadow-none">
                <button
                  type="button"
                  class="hover:bg-secondary/80 focus-visible:ring-ring/40 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-l-md px-2.5 text-[11px] font-medium transition focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-copy size-3.5"
                    aria-hidden="true"
                  >
                    <rect
                      width="14"
                      height="14"
                      x="8"
                      y="8"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                  </svg>
                  <span>Copy sprint</span>
                </button>
                <span class="bg-foreground/10 h-4 w-px self-center"></span>
                <button
                  type="button"
                  class="hover:bg-secondary/80 focus-visible:ring-ring/40 flex h-7 shrink-0 items-center justify-center rounded-r-md px-1.5 transition focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-label="More copy options"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-chevron-down size-3.5 transition-transform"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </button>
              </div>
            </div>
            <button class="flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-700 transition hover:bg-zinc-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-pencil size-3.5"
                aria-hidden="true"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>
                <path d="m15 5 4 4"></path>
              </svg>
              <span class="hidden sm:inline">Edit</span>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-200 pt-2 text-[11px]">
          <span class="inline-flex items-center gap-1.5 text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-calendar-range size-3"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="4" rx="2"></rect>
              <path d="M16 2v4"></path>
              <path d="M3 10h18"></path>
              <path d="M8 2v4"></path>
              <path d="M17 14h-6"></path>
              <path d="M13 18H7"></path>
              <path d="M7 14h.01"></path>
              <path d="M17 18h.01"></path>
            </svg>
            May 26 → Jun 8
          </span>
          <span class="text-zinc-500">13d left</span>
          <span class="text-zinc-500 tabular-nums">0/1 done</span>
          <span class="ml-auto text-zinc-400 tabular-nums">0%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-zinc-50">
          <div
            class="h-full bg-teal-500 transition-all"
            style="width: 0%;"
          ></div>
        </div>
      </div>{' '}
      <div className={`h-1.5 overflow-hidden rounded-full ${t.surfaceMuted}`}>
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${cycle.percent}%` }}
        />
      </div>
    </div>
  )
}
