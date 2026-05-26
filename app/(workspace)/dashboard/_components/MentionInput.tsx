'use client'

import { useMemo, useRef, useState } from 'react'
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
    return targets.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 6)
  }, [trigger, targets])

  const detectMention = (next: string, caret: number) => {
    const before = next.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setTrigger({ active: false, query: '', start: -1 })
      setHighlight(0)
      return
    }
    const between = before.slice(at + 1)
    if (/[\s\n@]/.test(between)) {
      setTrigger({ active: false, query: '', start: -1 })
      setHighlight(0)
      return
    }
    setTrigger({ active: true, query: between, start: at })
    setHighlight(0)
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
        className={`flex-1 resize-none rounded-md border px-3 py-2 text-xs transition focus:border-zinc-400 focus:outline-none dark:focus:border-white/30 ${t.input}`}
      />
      <button
        onClick={submit}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition ${t.accent}`}
      >
        <Send className="size-3.5" />
        Send
      </button>

      {trigger.active && matches.length > 0 && (
        <div
          className={`absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border py-1 shadow-xl ${t.detail}`}
        >
          {matches.map((m, i) => (
            <button
              key={m.id}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelectMention(m)
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                highlight === i ? t.btnActive : t.tab
              }`}
            >
              {m.member ? (
                <Avatar user={m.member} size={20} />
              ) : (
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ${t.surfaceMuted}`}
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
        className="inline-flex items-center rounded bg-teal-500/15 px-1 py-0.5 font-medium text-teal-500"
      >
        {chunk}
      </span>
    )
  })
}
