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

// Explicit per-name mention colors. Matched on the LOWERCASED FIRST WORD
// of the target's label so "Maryam Baig" and "maryam" both resolve. Add
// new entries here when teammates onboard; anyone not listed falls back
// to the hash palette below so colors stay deterministic + distinct.
const NAMED_MENTION_COLORS: Record<string, { bg: string; text: string }> = {
  team: {
    // The "everyone" mention - kept visually distinct from any single
    // person so it doesn't blur into one teammate's chip.
    bg: 'bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-300'
  },
  iona: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300'
  },
  maryam: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300'
  },
  seif: {
    // "Black" requested - use zinc so it reads on both light + dark
    // backgrounds (true black would vanish in dark mode).
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  seifelesllam: {
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  asim: {
    bg: 'bg-red-500/15',
    text: 'text-red-700 dark:text-red-300'
  },
  corentin: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300'
  },
  oheneba: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300'
  },
  radmila: {
    bg: 'bg-pink-500/15',
    text: 'text-pink-700 dark:text-pink-300'
  }
}

// Fallback palette - assigned deterministically by id so unlisted
// teammates still get a stable, distinct color.
const MENTION_PALETTE: { bg: string; text: string }[] = [
  { bg: 'bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300' },
  { bg: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-700 dark:text-fuchsia-300' }
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function mentionColor(
  id: string,
  label?: string
): { bg: string; text: string } {
  if (label) {
    const firstName = label.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    const override = NAMED_MENTION_COLORS[firstName]
    if (override) return override
  }
  return MENTION_PALETTE[hashString(id) % MENTION_PALETTE.length]
}

// Mentions render as inline chips using the classic "highlight overlay"
// trick: a transparent textarea sits on top of a div that mirrors the
// same text but with @mentions wrapped in styled spans. The textarea
// drives the caret; the div drives the visuals. The two elements must
// share font, padding, line-height, and white-space rules so the chip
// positions line up exactly with the underlying typed text.

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
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    if (!trigger.active) return []
    const q = trigger.query.toLowerCase()
    // Cap high enough to comfortably hold the whole team + the special
    // "team" target. A tight cap (6) silently dropped alphabetically-last
    // members like "Seifelesllam Seif" when the member typed @ without a
    // query yet.
    return targets.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 12)
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

  const handleScroll = () => {
    // Keep overlay scroll in sync with textarea so chips stay aligned
    // when the user types past the visible window.
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollTop = inputRef.current.scrollTop
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  }

  const handleSelectMention = (target: MentionTarget) => {
    if (trigger.start < 0) return
    const before = value.slice(0, trigger.start)
    const after = value.slice(trigger.start + 1 + trigger.query.length)
    const inserted = `@${target.label}`
    // Drop the trailing ", " unless the next thing is already punctuation
    // or whitespace, so picking a mention twice in a row doesn't produce
    // "@Maryam Baig, , @Asim Selim, ".
    const trailing = /^[\s,.;:!?]/.test(after) ? '' : ', '
    const next = `${before}${inserted}${trailing}${after}`
    setValue(next)
    setTrigger({ active: false, query: '', start: -1 })
    requestAnimationFrame(() => {
      const pos = (before + inserted + trailing).length
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

  // Build a list of "tokens" (plain text or mention chunks) for the overlay.
  // We greedily match the longest known mention label starting at each '@',
  // so "@Karim Saleh" wins over "@Karim".
  const targetsByFirstCharLower = useMemo(() => {
    // Sort longer labels first so longest-match-wins on each candidate.
    const sorted = [...targets].sort(
      (a, b) => b.label.length - a.label.length
    )
    return sorted
  }, [targets])

  const overlayTokens = useMemo(() => {
    const tokens: { text: string; targetId: string | null }[] = []
    let i = 0
    let buffer = ''
    while (i < value.length) {
      const ch = value[i]
      if (ch === '@') {
        // Find the longest matching label at this position.
        let matched: MentionTarget | null = null
        for (const target of targetsByFirstCharLower) {
          const candidate = value.slice(i + 1, i + 1 + target.label.length)
          if (candidate.toLowerCase() === target.label.toLowerCase()) {
            matched = target
            break
          }
        }
        if (matched) {
          if (buffer) {
            tokens.push({ text: buffer, targetId: null })
            buffer = ''
          }
          tokens.push({
            text: `@${value.slice(i + 1, i + 1 + matched.label.length)}`,
            targetId: matched.id
          })
          i += 1 + matched.label.length
          continue
        }
      }
      buffer += ch
      i++
    }
    if (buffer) tokens.push({ text: buffer, targetId: null })
    return tokens
  }, [value, targetsByFirstCharLower])

  const sharedTextClasses =
    'block px-3 py-2 text-xs leading-relaxed font-[inherit]'

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative flex min-h-[64px] flex-col rounded-md border transition ${
          focused
            ? 'border-zinc-400 dark:border-white/30'
            : t.input.split(' ').filter((c) => c.startsWith('border-')).join(' ')
        } ${t.input.split(' ').filter((c) => !c.startsWith('border-') && !c.startsWith('placeholder')).join(' ')}`}
      >
        <div
          ref={overlayRef}
          aria-hidden="true"
          className={`${sharedTextClasses} pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words`}
        >
          {overlayTokens.length === 0 && !value ? (
            <span className={`${t.textSubtle}`}>{placeholder}</span>
          ) : (
            // Chips must NOT add horizontal padding or change font-weight,
            // otherwise the overlay drifts horizontally from the textarea
            // and the caret no longer lines up with what the user sees.
            // Color comes from a tinted background + text color only.
            overlayTokens.map((tok, i) => {
              if (!tok.targetId) {
                return <span key={i}>{tok.text}</span>
              }
              const target = targets.find((tt) => tt.id === tok.targetId)
              const c = mentionColor(tok.targetId, target?.label)
              return (
                <span key={i} className={`rounded-sm ${c.bg} ${c.text}`}>
                  {tok.text}
                </span>
              )
            })
          )}
          {/* Trailing space so the overlay matches the textarea's vertical
              extent even when the last char is a newline. */}
          {'​'}
        </div>
        <textarea
          ref={inputRef}
          rows={3}
          value={value}
          onChange={handleChange}
          onScroll={handleScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (trigger.active && matches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => (h + 1) % matches.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight(
                  (h) => (h - 1 + matches.length) % matches.length
                )
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
          placeholder=""
          spellCheck={true}
          className={`${sharedTextClasses} relative min-h-[64px] w-full resize-none bg-transparent text-transparent caret-zinc-900 outline-none dark:caret-white`}
        />

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
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    everyone
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] ${t.textSubtle}`}>
          Type <kbd className="font-mono">@</kbd> to mention.
          <kbd className="ml-1 font-mono">⌘</kbd>
          <kbd className="font-mono">↵</kbd> to send.
        </span>
        <button
          onClick={submit}
          disabled={!value.trim()}
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.accent}`}
        >
          <Send className="size-3.5" />
          Send
        </button>
      </div>
    </div>
  )
}

export function renderMentionedBody(body: string, team: BoardAssignee[]) {
  // Walk the body the same way the input overlay does: at each '@', try
  // to match the longest known target label by EXACT slice. Only that
  // slice is colored - anything after stays plain text.
  //
  // The earlier regex-based approach matched whitespace inside the
  // mention bracket, so a comment like "@Maryam Baig thanks for the
  // review" colored the entire tail (target name was a startsWith
  // prefix of the over-greedy match).
  const targets = buildMentionTargets(team)
  // Longest label first so "@Karim Saleh" wins over "@Karim".
  const sortedTargets = [...targets].sort(
    (a, b) => b.label.length - a.label.length
  )

  const nodes: React.ReactNode[] = []
  let buffer = ''
  let i = 0
  let key = 0
  const flushBuffer = () => {
    if (buffer) {
      nodes.push(<span key={key++}>{buffer}</span>)
      buffer = ''
    }
  }
  while (i < body.length) {
    if (body[i] === '@') {
      let matched: MentionTarget | null = null
      for (const target of sortedTargets) {
        const candidate = body.slice(i + 1, i + 1 + target.label.length)
        if (candidate.toLowerCase() === target.label.toLowerCase()) {
          matched = target
          break
        }
      }
      if (matched) {
        flushBuffer()
        const text = `@${body.slice(i + 1, i + 1 + matched.label.length)}`
        const c = mentionColor(matched.id, matched.label)
        nodes.push(
          <span key={key++} className={`rounded-sm ${c.bg} ${c.text}`}>
            {text}
          </span>
        )
        i += 1 + matched.label.length
        continue
      }
    }
    buffer += body[i]
    i++
  }
  flushBuffer()
  return nodes
}
