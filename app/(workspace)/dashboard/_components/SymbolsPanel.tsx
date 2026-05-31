'use client'

import { useMemo } from 'react'
import {
  FileText,
  GitCommit,
  GitPullRequest,
  Link as LinkIcon,
  MessageCircleQuestion
} from 'lucide-react'
import {
  PRIORITY_LABEL,
  RELATION_LABEL,
  RelationKind,
  STATUSES,
  TaskPriority,
  TaskStatus
} from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import { useDashTheme } from './theme'
import type {
  BoardTask,
  Sprint,
  ProjectExternalRef,
  TaskExternalRef,
  TaskExternalRefKind
} from './boardData'

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']
const RELATIONS: RelationKind[] = [
  'triage',
  'blocked_by',
  'blocks',
  'parent',
  'sub_issue'
]

const STATUS_DESC: Record<TaskStatus, string> = {
  backlog: 'Captured but not yet picked up or scheduled.',
  unscoped: 'Needs more detail before it can be worked.',
  todo: 'Ready to start — fully scoped and unblocked.',
  in_progress: 'Someone is actively working on it.',
  in_review: 'Waiting on review or approval to ship.',
  done: 'Completed and shipped.',
  canceled: "Won't be done; closing without finishing.",
  duplicate: 'Tracked under another task instead.'
}

const PRIORITY_DESC: Record<TaskPriority, string> = {
  urgent: 'Drop other work - handle today.',
  high: 'Schedule before less-critical work in this sprint.',
  medium: 'Plan within the current sprint.',
  low: 'Nice to have; pick up when time allows.',
  none: 'No priority set yet.'
}

const RELATION_DESC: Record<RelationKind, string> = {
  triage: "Hasn't been categorized yet - needs a decision.",
  blocked_by: "Can't start until another task ships.",
  blocks: 'Other tasks are waiting on this one.',
  parent: 'Larger piece of work this task rolls up into.',
  sub_issue: 'Smaller part of a parent task.'
}

const SPRINT_STATUSES: {
  id: 'upcoming' | 'current' | 'completed'
  label: string
  desc: string
}[] = [
  {
    id: 'upcoming',
    label: 'Upcoming',
    desc: "Sprint that hasn't started yet."
  },
  {
    id: 'current',
    label: 'Current',
    desc: 'The sprint being worked right now.'
  },
  {
    id: 'completed',
    label: 'Completed',
    desc: 'Past sprint, kept for history.'
  }
]

const LINK_KINDS: {
  id: TaskExternalRefKind
  label: string
  desc: string
  Icon: typeof FileText
}[] = [
  {
    id: 'pr',
    label: 'Pull request',
    desc: 'GitHub pull request.',
    Icon: GitPullRequest
  },
  {
    id: 'issue',
    label: 'Issue',
    desc: 'GitHub issue.',
    Icon: MessageCircleQuestion
  },
  {
    id: 'commit',
    label: 'Commit',
    desc: 'A specific GitHub commit.',
    Icon: GitCommit
  },
  {
    id: 'doc',
    label: 'Document',
    desc: 'Google Docs, Notion, Figma, GitHub wiki, or any .md file.',
    Icon: FileText
  },
  {
    id: 'link',
    label: 'Link',
    desc: 'Anything else — a generic URL.',
    Icon: LinkIcon
  }
]

interface SymbolsPanelProps {
  tasks: BoardTask[]
  sprints: Sprint[]
  refsByTask: Record<string, TaskExternalRef[]>
  refsByProject: Record<string, ProjectExternalRef[]>
  onFilterByStatus: (status: TaskStatus) => void
  onFilterByPriority: (priority: TaskPriority) => void
}

export default function SymbolsPanel({
  tasks,
  sprints,
  refsByTask,
  refsByProject,
  onFilterByStatus,
  onFilterByPriority
}: SymbolsPanelProps) {
  const { t } = useDashTheme()

  const statusCounts = useMemo(() => {
    const c: Record<TaskStatus, number> = {
      backlog: 0,
      unscoped: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      canceled: 0,
      duplicate: 0
    }
    for (const task of tasks) c[task.status] = (c[task.status] ?? 0) + 1
    return c
  }, [tasks])

  const priorityCounts = useMemo(() => {
    const c: Record<TaskPriority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0
    }
    for (const task of tasks) c[task.priority] = (c[task.priority] ?? 0) + 1
    return c
  }, [tasks])

  const relationCounts = useMemo(() => {
    const c: Record<RelationKind, number> = {
      triage: 0,
      blocked_by: 0,
      blocks: 0,
      parent: 0,
      sub_issue: 0
    }
    for (const task of tasks) {
      for (const rel of task.relations ?? []) {
        c[rel.kind] = (c[rel.kind] ?? 0) + 1
      }
    }
    return c
  }, [tasks])

  const sprintCounts = useMemo(() => {
    const c: Record<'upcoming' | 'current' | 'completed', number> = {
      upcoming: 0,
      current: 0,
      completed: 0
    }
    for (const sprint of sprints) c[sprint.status] = (c[sprint.status] ?? 0) + 1
    return c
  }, [sprints])

  const linkCounts = useMemo(() => {
    const c: Record<TaskExternalRefKind, number> = {
      pr: 0,
      issue: 0,
      commit: 0,
      doc: 0,
      link: 0,
      supabase: 0,
      github: 0,
      figma: 0,
      verbivore: 0,
      vercel: 0,
      bunny: 0,
      sentry: 0,
      gcloud: 0,
      stripe: 0
    }
    for (const list of Object.values(refsByTask)) {
      for (const ref of list) c[ref.kind] = (c[ref.kind] ?? 0) + 1
    }
    for (const list of Object.values(refsByProject)) {
      for (const ref of list) c[ref.kind] = (c[ref.kind] ?? 0) + 1
    }
    return c
  }, [refsByTask, refsByProject])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-8">
        <header>
          <h2 className={`text-2xl font-medium ${t.text}`}>Symbol library</h2>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Every icon used across the dashboard, what it means, and how many of
            each you currently have. Click a status or priority to jump to the
            board filtered by it.
          </p>
        </header>

        <Section
          title="Statuses"
          hint="Where a task sits in the flow - click to filter the board."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map((s) => (
              <SymbolCell
                key={s.id}
                icon={<StatusIcon status={s.id} className="size-5" />}
                label={s.label}
                description={STATUS_DESC[s.id]}
                count={statusCounts[s.id]}
                onClick={() => onFilterByStatus(s.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Priorities"
          hint="How urgent a task is click to filter the board."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRIORITIES.map((p) => (
              <SymbolCell
                key={p}
                icon={<PriorityIcon priority={p} className="size-5" />}
                label={PRIORITY_LABEL[p]}
                description={PRIORITY_DESC[p]}
                count={priorityCounts[p]}
                onClick={() => onFilterByPriority(p)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Relations"
          hint="How tasks connect to each other in the detail panel."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RELATIONS.map((r) => (
              <SymbolCell
                key={r}
                icon={<RelationIcon kind={r} className="size-5" />}
                label={RELATION_LABEL[r]}
                description={RELATION_DESC[r]}
                count={relationCounts[r]}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Sprint statuses"
          hint="Lifesprint of a sprint in the Sprints tab."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SPRINT_STATUSES.map((c) => (
              <SymbolCell
                key={c.id}
                icon={<SprintDot status={c.id} />}
                label={c.label}
                description={c.desc}
                count={sprintCounts[c.id]}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Link kinds"
          hint="What we infer from a URL pasted into a task or project."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LINK_KINDS.map((k) => (
              <SymbolCell
                key={k.id}
                icon={<k.Icon className={`size-5 ${t.textMuted}`} />}
                label={k.label}
                description={k.desc}
                count={linkCounts[k.id]}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  hint,
  children
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3
          className={`text-[10px] tracking-[0.25em] uppercase ${t.textMuted}`}
        >
          {title}
        </h3>
        {hint && <p className={`text-xs ${t.textSubtle}`}>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function SymbolCell({
  icon,
  label,
  description,
  count,
  onClick
}: {
  icon: React.ReactNode
  label: string
  description: string
  count: number
  onClick?: () => void
}) {
  const { t } = useDashTheme()
  const interactive = typeof onClick === 'function'
  const baseClass = `flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${t.column}`
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-zinc-400 dark:hover:border-white/30'
    : ''
  const inner = (
    <>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${t.text}`}>{label}</span>
          <span
            className={`shrink-0 text-[11px] tabular-nums ${
              count > 0 ? t.textMuted : t.textSubtle
            }`}
          >
            {count}
          </span>
        </div>
        <span className={`text-xs leading-snug ${t.textMuted}`}>
          {description}
        </span>
      </div>
    </>
  )
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} ${interactiveClass}`}
      >
        {inner}
      </button>
    )
  }
  return <div className={baseClass}>{inner}</div>
}

function SprintDot({
  status
}: {
  status: 'upcoming' | 'current' | 'completed'
}) {
  if (status === 'completed') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
        <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-300" />
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
        <span className="size-2 rounded-full bg-amber-600 dark:bg-amber-300" />
      </span>
    )
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-zinc-400 dark:border-white/30">
      <span className="size-2 rounded-full bg-zinc-300 dark:bg-white/30" />
    </span>
  )
}
