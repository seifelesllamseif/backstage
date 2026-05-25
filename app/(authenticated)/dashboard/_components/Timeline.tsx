'use client'

import { useMemo } from 'react'
import { BoardTask } from './boardData'
import { STATUS_BY_ID } from './status'
import StatusIcon from './StatusIcon'
import { useDashTheme } from './theme'

interface TimelineProps {
  tasks: BoardTask[]
  onSelect: (id: string) => void
}

const TODAY = new Date('2026-05-22')

function parseDue(s: string | undefined): Date | null {
  if (!s || s === '—') return null
  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  }
  const m = s.match(/^([A-Za-z]{3})\s+(\d{1,2})$/)
  if (!m) return null
  const mon = months[m[1] as keyof typeof months]
  if (mon === undefined) return null
  return new Date(2026, mon, parseInt(m[2], 10))
}

const TOTAL_DAYS = 24

export default function Timeline({ tasks, onSelect }: TimelineProps) {
  const { t, mode } = useDashTheme()

  const start = useMemo(() => {
    const d = new Date(TODAY)
    d.setDate(d.getDate() - 4)
    return d
  }, [])

  const days = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [start])

  const rows = useMemo(() => {
    return tasks
      .map((task) => {
        const created = new Date(task.createdAt)
        const due = parseDue(task.due)
        const from = created < start ? start : created
        const to = due ?? new Date(start.getTime() + 1000 * 60 * 60 * 24 * 14)
        const offsetDays = Math.max(
          0,
          Math.floor((from.getTime() - start.getTime()) / 86400000)
        )
        const span = Math.max(
          1,
          Math.min(
            TOTAL_DAYS - offsetDays,
            Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1
          )
        )
        return { task, offsetDays, span, due }
      })
      .filter((r) => r.span > 0)
  }, [tasks, start])

  const todayOffset = Math.floor((TODAY.getTime() - start.getTime()) / 86400000)

  const trackBg = mode === 'light' ? 'bg-zinc-50' : 'bg-white/[0.02]'
  const gridLine = mode === 'light' ? 'border-zinc-100' : 'border-white/5'

  const barColor = (status: BoardTask['status']) => {
    if (mode === 'light') {
      return {
        backlog: 'bg-yellow-200/80 border-yellow-300',
        unscoped: 'bg-zinc-100 border-zinc-200',
        todo: 'bg-zinc-200 border-zinc-300',
        in_progress: 'bg-amber-200 border-amber-300',
        in_review: 'bg-sky-200 border-sky-300',
        done: 'bg-emerald-200 border-emerald-300',
        canceled: 'bg-rose-200 border-rose-300 line-through',
        duplicate: 'bg-rose-100 border-rose-200 line-through'
      }[status]
    }
    return {
      backlog: 'bg-yellow-300/30 border-yellow-300/50',
      unscoped: 'bg-white/10 border-white/20',
      todo: 'bg-white/15 border-white/30',
      in_progress: 'bg-amber-400/30 border-amber-400/50',
      in_review: 'bg-sky-400/30 border-sky-400/50',
      done: 'bg-emerald-400/30 border-emerald-400/50',
      canceled: 'bg-rose-400/30 border-rose-400/50 line-through',
      duplicate: 'bg-rose-300/20 border-rose-300/40 line-through'
    }[status]
  }

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border ${t.column}`}
    >
      <div className={`flex border-b ${t.columnHeader}`}>
        <div
          className={`w-56 shrink-0 px-3 py-2 text-[10px] tracking-wider uppercase ${t.textMuted}`}
        >
          Task
        </div>
        <div
          className="grid flex-1"
          style={{
            gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))`
          }}
        >
          {days.map((d, i) => (
            <div
              key={i}
              className={`border-l px-1 py-2 text-center text-[10px] tracking-wider uppercase ${gridLine} ${
                i === todayOffset ? t.accentText : t.textSubtle
              }`}
            >
              {d.getDate()}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.map(({ task, offsetDays, span }) => {
          const colors = barColor(task.status)
          return (
            <div
              key={task.id}
              className={`flex border-b ${t.dividerSoft} ${t.rowHover}`}
            >
              <button
                onClick={() => onSelect(task.id)}
                className={`flex w-56 shrink-0 items-center gap-2 px-3 py-2.5 text-left text-xs ${t.text}`}
              >
                <StatusIcon status={task.status} className="size-3 shrink-0" />
                <span className="truncate">{task.title}</span>
              </button>
              <div
                className={`relative flex-1 ${trackBg}`}
                style={{ minHeight: 40 }}
              >
                <div
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${TOTAL_DAYS}, minmax(0, 1fr))`
                  }}
                >
                  {days.map((_, i) => (
                    <div key={i} className={`border-l ${gridLine}`} />
                  ))}
                </div>
                <button
                  onClick={() => onSelect(task.id)}
                  className={`absolute top-1.5 bottom-1.5 flex items-center rounded-md border px-2 text-[10px] ${colors}`}
                  style={{
                    left: `${(offsetDays / TOTAL_DAYS) * 100}%`,
                    width: `${(span / TOTAL_DAYS) * 100}%`
                  }}
                >
                  <span className="truncate font-medium text-zinc-900 dark:text-white/90">
                    {task.ref}
                  </span>
                </button>
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500"
                  style={{ left: `${(todayOffset / TOTAL_DAYS) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className={`px-3 py-6 text-center text-xs italic ${t.textSubtle}`}>
            No tasks in this range.
          </p>
        )}
      </div>
    </div>
  )
}
