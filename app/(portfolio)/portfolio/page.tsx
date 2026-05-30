import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentTeamMember } from '@/lib/dal'

// /portfolio is every member's personal landing page. Replaces the old
// (profile) route group: one page, one URL, always tied to the signed-in
// user. Constraints:
//  - The page never scrolls. Everything fits inside the viewport; lists
//    cap at a visible count with "+N more" overflow.
//  - Theme follows the global next-themes choice. We use shadcn tokens
//    (bg-background / border / muted-foreground) instead of hardcoded
//    black-on-white so light + dark land for free.

export const metadata: Metadata = {
  title: 'Portfolio · Verbivore',
  description: "Your space — tasks, sprint, mentions, profile."
}

const ROLE_LABEL: Record<'admin' | 'lead' | 'member', string> = {
  admin: 'Admin',
  lead: 'Lead',
  member: 'Member'
}

function formatDue(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function PortfolioPage() {
  const me = await getCurrentTeamMember()
  if (!me) {
    throw new Error('No team_member row for the current auth user.')
  }

  const [openTasks, doneThisMonth, mentionsCount, currentSprint] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          companyId: me.companyId,
          assigneeId: me.id,
          status: { notIn: ['done', 'canceled', 'duplicate'] }
        },
        include: { project: { select: { name: true } } },
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { updatedAt: 'desc' }
        ],
        take: 30
      }),
      prisma.task.count({
        where: {
          companyId: me.companyId,
          assigneeId: me.id,
          status: 'done',
          updatedAt: {
            gte: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1
            )
          }
        }
      }),
      prisma.activityLog
        .count({
          where: {
            companyId: me.companyId,
            entityType: 'task',
            metadata: { path: ['mentions'], array_contains: me.id }
          }
        })
        .catch(() => 0),
      prisma.sprint.findFirst({
        where: { companyId: me.companyId, status: 'current' },
        include: {
          project: { select: { name: true } },
          tasks: { select: { taskId: true } }
        },
        orderBy: { fromDate: 'desc' }
      })
    ])

  const openCount = openTasks.length
  const urgentCount = openTasks.filter((t) => t.priority === 'urgent').length
  const reviewCount = openTasks.filter((t) => t.status === 'in_review').length

  const visibleTasks = openTasks.slice(0, 6)
  const overflowTaskCount = Math.max(0, openTasks.length - visibleTasks.length)

  // Sprint progress against the member's visible scope: count their open
  // tasks that live in the sprint vs the sprint's total task scope.
  let sprintProgress: { done: number; scope: number; percent: number } | null
  if (currentSprint) {
    const sprintTaskIds = new Set(currentSprint.tasks.map((t) => t.taskId))
    const completed = await prisma.task.count({
      where: {
        id: { in: [...sprintTaskIds] },
        status: 'done'
      }
    })
    const scope = sprintTaskIds.size
    sprintProgress = {
      done: completed,
      scope,
      percent: scope === 0 ? 0 : Math.round((completed / scope) * 100)
    }
  } else {
    sprintProgress = null
  }

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 text-xs">
        <span className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          Verbivore · Portfolio
        </span>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
        >
          Dashboard
          <ArrowRight className="size-3" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        {/* Top row: identity, stats, current sprint. */}
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-3">
          <IdentityCard
            name={me.fullName}
            role={ROLE_LABEL[me.accessTier as 'admin' | 'lead' | 'member']}
            avatarUrl={me.avatarUrl}
            bio={me.bio}
          />
          <StatsCard
            open={openCount}
            urgent={urgentCount}
            review={reviewCount}
            doneThisMonth={doneThisMonth}
            mentions={mentionsCount}
          />
          <SprintCard
            sprintName={currentSprint?.name ?? null}
            projectName={currentSprint?.project?.name ?? null}
            progress={sprintProgress}
          />
        </div>

        {/* Tasks panel takes the remaining vertical space without
            allowing the page to grow past 100vh. The list itself stays
            scroll-free; overflow shows as a "+N more" footer row. */}
        <section className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <div className="flex shrink-0 items-baseline justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                Your open tasks
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Sorted by due date, then most recently updated.
              </p>
            </div>
            <Link
              href="/dashboard?view=mine"
              className="text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              Open in dashboard →
            </Link>
          </div>
          {visibleTasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
              No open tasks assigned to you right now.
            </div>
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
              {visibleTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs"
                >
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] tracking-wider tabular-nums text-muted-foreground uppercase">
                    {task.ref ?? task.id.slice(0, 8)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {task.title}
                  </span>
                  <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                    {task.project?.name}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {formatDue(task.dueDate)}
                  </span>
                </li>
              ))}
              {overflowTaskCount > 0 && (
                <li className="text-[11px] italic text-muted-foreground">
                  + {overflowTaskCount} more in the dashboard
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function IdentityCard({
  name,
  role,
  avatarUrl,
  bio
}: {
  name: string
  role: string
  avatarUrl: string | null
  bio: string | null
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="size-12 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-foreground">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {name}
          </span>
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {role}
          </span>
        </div>
      </div>
      <p className="line-clamp-4 min-h-0 flex-1 text-xs leading-relaxed text-muted-foreground">
        {bio ?? 'No bio yet. Add one from your account settings.'}
      </p>
    </div>
  )
}

function StatsCard({
  open,
  urgent,
  review,
  doneThisMonth,
  mentions
}: {
  open: number
  urgent: number
  review: number
  doneThisMonth: number
  mentions: number
}) {
  return (
    <div className="grid min-h-0 grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4">
      <Stat label="Open" value={open} />
      <Stat label="Urgent" value={urgent} accent />
      <Stat label="In review" value={review} />
      <Stat label="Done · month" value={doneThisMonth} />
      <Stat label="Mentions" value={mentions} className="col-span-2" />
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  className
}: {
  label: string
  value: number
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-col rounded-md border border-border bg-background px-3 py-2 ${className ?? ''}`}
    >
      <span
        className={`text-2xl font-medium tabular-nums ${
          accent ? 'text-red-500 dark:text-red-400' : 'text-foreground'
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  )
}

function SprintCard({
  sprintName,
  projectName,
  progress
}: {
  sprintName: string | null
  projectName: string | null
  progress: { done: number; scope: number; percent: number } | null
}) {
  return (
    <div className="flex min-h-0 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Current sprint
        </span>
        {sprintName ? (
          <>
            <span className="truncate text-sm font-medium text-foreground">
              {sprintName}
            </span>
            {projectName && (
              <span className="truncate text-[11px] text-muted-foreground">
                {projectName}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            No sprint is currently active across your projects.
          </span>
        )}
      </div>
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {progress.done}/{progress.scope || 0} done
            </span>
            <span className="tabular-nums">{progress.percent}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-teal-500 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
