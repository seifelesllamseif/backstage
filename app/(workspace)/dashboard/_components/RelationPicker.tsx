'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import {
  RELATION_LABEL,
  RelationKind
} from './status'
import RelationIcon from './RelationIcon'
import { useDashTheme } from './theme'
import type { BoardTask, TaskRelation } from './boardData'

// Reusable relation picker. Shows the current relations as removable
// chips and offers an inline form to add new ones: pick a kind, then
// autocomplete a target task by ref or title.
//
// Two modes:
//  - server-backed: pass `onAdd` / `onRemove` callbacks that hit the
//    server actions. Used by TaskDetail.
//  - local-pending: same shape, but the parent stores the pending list
//    locally and submits everything on form submit. Used by NewTaskModal.

const RELATION_KINDS: RelationKind[] = [
  'blocked_by',
  'blocks',
  'parent',
  'sub_issue',
  'triage'
]

export interface RelationPickerProps {
  // Currently-attached relations.
  relations: TaskRelation[]
  // Pool of tasks to autocomplete against.
  candidates: Pick<BoardTask, 'id' | 'ref' | 'title' | 'status'>[]
  // Optional ref to exclude (the task being edited, so you can't self-link).
  selfRef?: string
  onAdd: (rel: TaskRelation) => void
  onRemove: (rel: TaskRelation) => void
  // Visual variant: "compact" tightens spacing for inline use inside
  // a field grid. "spacious" gives breathing room for a standalone
  // section (NewTaskModal).
  variant?: 'compact' | 'spacious'
  disabled?: boolean
}

export default function RelationPicker({
  relations,
  candidates,
  selfRef,
  onAdd,
  onRemove,
  variant = 'compact',
  disabled = false
}: RelationPickerProps) {
  const { t } = useDashTheme()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<RelationKind>('blocked_by')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((c) => !selfRef || c.ref !== selfRef)
      .filter((c) => {
        if (!q) return true
        return (
          c.ref.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [candidates, query, selfRef])

  useEffect(() => {
    if (adding) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [adding])

  const submit = (target: typeof candidates[number] | undefined) => {
    const picked = target ?? filteredCandidates[highlight]
    if (!picked) return
    onAdd({ kind, ref: picked.ref })
    setQuery('')
    setHighlight(0)
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {relations.length === 0 && !adding && (
          <span className={`text-[11px] italic ${t.textSubtle}`}>
            No relations yet
          </span>
        )}
        {relations.map((rel, i) => (
          <span
            key={`${rel.kind}-${rel.ref}-${i}`}
            className={`group inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${t.metaTag}`}
          >
            <RelationIcon kind={rel.kind} className="size-3.5" />
            <span className={t.textMuted}>{RELATION_LABEL[rel.kind]}</span>
            <span
              className={`text-[10px] tracking-wider uppercase ${t.text}`}
            >
              {rel.ref}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(rel)}
                aria-label={`Remove ${RELATION_LABEL[rel.kind]} ${rel.ref}`}
                className={`flex size-4 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${t.tab}`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}

        {!adding && !disabled && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`ml-auto flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] transition ${t.btn}`}
          >
            <Plus className="size-3" />
            Add relation
          </button>
        )}
      </div>

      {adding && (
        <div
          className={`flex flex-col gap-2 rounded-md border p-2 ${t.border} ${t.surfaceMuted}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {RELATION_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] transition ${
                  kind === k ? t.chipActive : t.chip
                }`}
              >
                <RelationIcon kind={k} className="size-3" />
                {RELATION_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 ${t.textSubtle}`}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHighlight(0)
              }}
              onKeyDown={(e) => {
                if (filteredCandidates.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlight((h) =>
                      Math.min(h + 1, filteredCandidates.length - 1)
                    )
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlight((h) => Math.max(0, h - 1))
                    return
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit(filteredCandidates[highlight])
                    return
                  }
                }
                if (e.key === 'Escape') {
                  setAdding(false)
                  setQuery('')
                  setHighlight(0)
                }
              }}
              placeholder="Search by ref or title (e.g. LMS-12 or audit)…"
              className={`h-8 w-full rounded-md border pr-2 pl-7 text-xs ${t.input}`}
            />
          </div>
          {query && filteredCandidates.length === 0 && (
            <p className={`px-1 text-[10px] italic ${t.textSubtle}`}>
              No tasks match.
            </p>
          )}
          {filteredCandidates.length > 0 && (
            <ul
              className={`flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-md border ${t.border}`}
            >
              {filteredCandidates.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => submit(c)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition ${
                      highlight === i ? t.btnActive : t.tab
                    }`}
                  >
                    <span
                      className={`shrink-0 rounded border px-1 py-0.5 text-[10px] tracking-wider tabular-nums uppercase ${t.metaTag}`}
                    >
                      {c.ref}
                    </span>
                    <span className={`min-w-0 truncate ${t.text}`}>
                      {c.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setQuery('')
                setHighlight(0)
              }}
              className={`flex h-7 items-center rounded-md border px-2 text-[11px] ${t.btn}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
