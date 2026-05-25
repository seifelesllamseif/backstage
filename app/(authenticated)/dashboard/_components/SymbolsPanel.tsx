'use client'

import {
  PRIORITY_LABEL,
  RELATION_LABEL,
  RelationKind,
  STATUSES,
  STATUS_BY_ID,
  TaskPriority
} from './status'
import StatusIcon from './StatusIcon'
import PriorityIcon from './PriorityIcon'
import RelationIcon from './RelationIcon'
import { useDashTheme } from './theme'

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']
const RELATIONS: RelationKind[] = [
  'triage',
  'blocked_by',
  'blocks',
  'parent',
  'sub_issue'
]

export default function SymbolsPanel() {
  const { t } = useDashTheme()
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <header>
          <h2 className={`text-2xl font-medium ${t.text}`}>Symbol library</h2>
          <p className={`text-sm mt-1 ${t.textMuted}`}>
            The icons we use across the dashboard. Same set, two modes — pick a
            status or relation and it renders the right shape automatically.
          </p>
        </header>

        <Section title="Statuses">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATUSES.map((s) => (
              <SymbolCell
                key={s.id}
                icon={<StatusIcon status={s.id} className="size-5" />}
                label={s.label}
              />
            ))}
          </div>
        </Section>

        <Section title="Relations">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {RELATIONS.map((r) => (
              <SymbolCell
                key={r}
                icon={<RelationIcon kind={r} className="size-5" />}
                label={RELATION_LABEL[r]}
              />
            ))}
          </div>
        </Section>

        <Section title="Priorities">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {PRIORITIES.map((p) => (
              <SymbolCell
                key={p}
                icon={<PriorityIcon priority={p} className="size-5" />}
                label={PRIORITY_LABEL[p]}
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
  children
}: {
  title: string
  children: React.ReactNode
}) {
  const { t } = useDashTheme()
  return (
    <section className="flex flex-col gap-3">
      <h3
        className={`text-[10px] uppercase tracking-[0.25em] ${t.textMuted}`}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function SymbolCell({
  icon,
  label
}: {
  icon: React.ReactNode
  label: string
}) {
  const { t } = useDashTheme()
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${t.column}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`text-sm ${t.text}`}>{label}</span>
    </div>
  )
}
