'use client'

import { useState } from 'react'
import { BoardTask } from './boardData'
import { STATUS_BY_ID } from './status'
import StatusIcon from './StatusIcon'
import { useDashTheme } from './theme'

export function ProjectsPanel({ tasks }: { tasks: BoardTask[] }) {
  const { t } = useDashTheme()
  const byTag = new Map<string, BoardTask[]>()
  for (const task of tasks) {
    for (const tag of task.tags ?? ['General']) {
      const list = byTag.get(tag) ?? []
      list.push(task)
      byTag.set(tag, list)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...byTag.entries()].map(([tag, list]) => {
          const done = list.filter((x) => x.status === 'done').length
          const pct = Math.round((done / list.length) * 100)
          return (
            <div
              key={tag}
              className={`rounded-xl border p-4 flex flex-col gap-3 ${t.column}`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-medium ${t.text}`}>{tag}</h3>
                <span className={`text-[10px] ${t.textMuted}`}>
                  {done}/{list.length} done
                </span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${t.surfaceMuted}`}>
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ul className="flex flex-col gap-1.5">
                {list.slice(0, 5).map((task) => (
                  <li
                    key={task.id}
                    className={`flex items-center gap-2 text-xs ${t.textMuted}`}
                  >
                    <StatusIcon status={task.status} className="size-3 shrink-0" />
                    <span className="truncate">{task.title}</span>
                  </li>
                ))}
                {list.length > 5 && (
                  <li className={`text-[10px] italic ${t.textSubtle}`}>
                    +{list.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function UpdatesPanel({ activity }: { activity: { id: string; text: string; at: string }[] }) {
  const { t } = useDashTheme()
  if (activity.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center text-sm italic ${t.textSubtle}`}>
        No updates yet — start moving cards.
      </div>
    )
  }
  return (
    <div className="h-full overflow-y-auto p-4">
      <ul className="flex flex-col gap-2 max-w-2xl mx-auto">
        {activity.map((a) => (
          <li
            key={a.id}
            className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${t.column}`}
          >
            <span className={t.text}>{a.text}</span>
            <span className={`text-[10px] uppercase tracking-wider ${t.textSubtle}`}>
              {a.at}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SettingsPanel({
  density,
  setDensity,
  wipLimit,
  setWipLimit,
  notifyOnAssign,
  setNotifyOnAssign,
  onClearTasks
}: {
  density: 'compact' | 'cozy'
  setDensity: (d: 'compact' | 'cozy') => void
  wipLimit: number
  setWipLimit: (n: number) => void
  notifyOnAssign: boolean
  setNotifyOnAssign: (b: boolean) => void
  onClearTasks: () => void
}) {
  const { t } = useDashTheme()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-5">
        <h2 className={`text-lg font-medium ${t.text}`}>Workspace settings</h2>

        <Row label="Card density">
          <ToggleGroup
            value={density}
            onChange={(v) => setDensity(v as 'compact' | 'cozy')}
            options={[
              { id: 'compact', label: 'Compact' },
              { id: 'cozy', label: 'Cozy' }
            ]}
          />
        </Row>

        <Row label="WIP limit per column">
          <input
            type="number"
            min={0}
            value={wipLimit}
            onChange={(e) => setWipLimit(Math.max(0, Number(e.target.value)))}
            className={`h-9 w-24 rounded-md border px-2 text-xs ${t.input}`}
          />
        </Row>

        <Row label="Notify on assignment">
          <button
            onClick={() => setNotifyOnAssign(!notifyOnAssign)}
            className={`relative h-6 w-11 rounded-full border transition ${
              notifyOnAssign ? 'bg-red-500 border-red-500' : t.surfaceMuted + ' ' + t.border
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 bg-white rounded-full transition-transform ${
                notifyOnAssign ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </Row>

        <div className={`border-t pt-5 ${t.border}`}>
          <h3 className={`text-sm font-medium mb-2 ${t.text}`}>Danger zone</h3>
          <p className={`text-xs mb-3 ${t.textMuted}`}>
            Reset the board back to the seeded SKAM tasks. This clears your
            local edits.
          </p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className={`h-9 px-3 rounded-md border text-xs ${t.btn}`}
            >
              Reset board
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${t.text}`}>Are you sure?</span>
              <button
                onClick={() => {
                  onClearTasks()
                  setConfirming(false)
                }}
                className={`h-8 px-3 rounded-md text-xs ${t.accent}`}
              >
                Reset
              </button>
              <button
                onClick={() => setConfirming(false)}
                className={`h-8 px-3 rounded-md border text-xs ${t.btn}`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${t.text}`}>{label}</span>
      {children}
    </div>
  )
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  const { t } = useDashTheme()
  return (
    <div className={`inline-flex items-center rounded-md border p-0.5 ${t.border}`}>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 rounded text-xs transition ${
            value === opt.id ? t.tabActive : t.tab
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
