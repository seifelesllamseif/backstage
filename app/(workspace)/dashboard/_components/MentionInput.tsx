'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { BoardAssignee } from './boardData'
import { useTeam } from './TeamContext'
import Avatar from './Avatar'
import { useDashTheme } from './theme'

interface MentionInputProps {
  onSubmit: (body: string, mentions: string[]) => void
  placeholder?: string
}

interface TriggerState {
  active: boolean
  query: string
  start: number
  rect?: { left: number; top: number; bottom: number }
}

type MentionTarget = { id: string; label: string; member?: BoardAssignee }

function buildMentionTargets(team: BoardAssignee[]): MentionTarget[] {
  return [
    { id: 'team', label: 'team' },
    ...team.map((m) => ({ id: m.id, label: m.name, member: m }))
  ]
}

export default function MentionInput({
  onSubmit,
  placeholder = 'Leave a comment… type @ to mention'
}: MentionInputProps) {
  const { t } = useDashTheme()
  const team = useTeam()
  const targets = useMemo(() => buildMentionTargets(team), [team])
  const [value, setValue] = useState('')
  const [trigger, setTrigger] = useState<TriggerState>({
    active: false,
    query: '',
    start: -1
  })
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const matches = useMemo(() => {
    if (!trigger.active) return []
    const q = trigger.query.toLowerCase()
    return targets.filter((m) =>
      m.label.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [trigger, targets])

  useEffect(() => {
    setHighlight(0)
  }, [trigger.query, trigger.active])

  const detectMention = (next: string, caret: number) => {
    const before = next.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setTrigger({ active: false, query: '', start: -1 })
      return
    }
    const between = before.slice(at + 1)
    if (/[\s\n@]/.test(between)) {
      setTrigger({ active: false, query: '', start: -1 })
      return
    }
    setTrigger({ active: true, query: between, start: at })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    detectMention(e.target.value, e.target.selectionStart)
  }

  const handleSelectMention = (target: MentionTarget) => {
    if (trigger.start < 0) return
    const before = value.slice(0, trigger.start)
    const after = value.slice(trigger.start + 1 + trigger.query.length)
    const inserted = `@${target.label}`
    const next = `${before}${inserted} ${after}`
    setValue(next)
    setTrigger({ active: false, query: '', start: -1 })
    requestAnimationFrame(() => {
      const pos = (before + inserted + ' ').length
      inputRef.current?.setSelectionRange(pos, pos)
      inputRef.current?.focus()
    })
  }

  const submit = () => {
    const body = value.trim()
    if (!body) return
    const mentions: string[] = []
    for (const target of targets) {
      const re = new RegExp(`@${target.label.replace(/\./g, '\\.')}`, 'g')
      if (re.test(body)) mentions.push(target.id)
    }
    onSubmit(body, mentions)
    setValue('')
  }

  return (
    <div className="relative flex items-end gap-2">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (trigger.active && matches.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight((h) => (h + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((h) => (h - 1 + matches.length) % matches.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              handleSelectMention(matches[highlight])
              return
            }
            if (e.key === 'Escape') {
              setTrigger({ active: false, query: '', start: -1 })
              return
            }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        className={`flex-1 rounded-md border px-3 py-2 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition resize-none ${t.input}`}
      />
      <button
        onClick={submit}
        className={`h-9 px-3 rounded-md text-xs flex items-center gap-1.5 transition shrink-0 ${t.accent}`}
      >
        <Send className="size-3.5" />
        Send
      </button>

      {trigger.active && matches.length > 0 && (
        <div
          className={`absolute bottom-full left-0 mb-1 w-64 rounded-md border shadow-xl py-1 z-30 ${t.detail}`}
        >
          {matches.map((m, i) => (
            <button
              key={m.id}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelectMention(m)
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left ${
                highlight === i ? t.btnActive : t.tab
              }`}
            >
              {m.member ? (
                <Avatar user={m.member} size={20} />
              ) : (
                <span
                  className={`size-5 rounded-full text-[9px] font-semibold flex items-center justify-center ${t.surfaceMuted}`}
                >
                  @
                </span>
              )}
              <span className="flex-1 truncate">{m.label}</span>
              {!m.member && (
                <span className={`text-[10px] ${t.textSubtle}`}>everyone</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function renderMentionedBody(body: string, team: BoardAssignee[]) {
  const pattern = /(@[A-Za-z][A-Za-zÇŞĞıİİöÖüÜğçşı.\s]*[A-Za-zÇŞĞıİİöÖüÜğçş])/g
  const targets = buildMentionTargets(team)
  const targetLabels = new Set(targets.map((m) => m.label.toLowerCase()))
  return body.split(pattern).map((chunk, i) => {
    if (!chunk.startsWith('@')) return <span key={i}>{chunk}</span>
    const label = chunk.slice(1).trim()
    const exact =
      targetLabels.has(label.toLowerCase()) ||
      targets.some((m) => label.toLowerCase().startsWith(m.label.toLowerCase()))
    if (!exact) return <span key={i}>{chunk}</span>
    return (
      <span
        key={i}
        className="inline-flex items-center rounded bg-red-500/15 text-red-500 px-1 py-0.5 font-medium"
      >
        {chunk}
      </span>
    )
  })
}
