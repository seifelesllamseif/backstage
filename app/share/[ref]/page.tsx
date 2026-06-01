import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowUpRight, CalendarDays, FolderKanban } from 'lucide-react'
import { fetchTaskByRef } from '@/supabase/dashboard/fetchTaskByRef'

type Params = Promise<{ ref: string }>

const MAX_DESC_CHARS = 160

function metaDescription(task: {
  description: string | null
  project: { name: string }
  status: string
  priority: string
  assignee: { fullName: string } | null
}): string {
  const trimmed = task.description?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed.length > MAX_DESC_CHARS
      ? `${trimmed.slice(0, MAX_DESC_CHARS - 1)}…`
      : trimmed
  }
  const parts = [task.project.name, labelForStatus(task.status)]
  if (task.priority && task.priority !== 'none') {
    parts.push(`${capitalize(task.priority)} priority`)
  }
  if (task.assignee) parts.push(task.assignee.fullName)
  return parts.join(' · ')
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { ref } = await params
  const task = await fetchTaskByRef(ref)
  if (!task) {
    return {
      title: `${ref} · Verbivore`,
      description: 'Task not found on Verbivore Backstage.'
    }
  }
  const desc = metaDescription(task)
  return {
    title: `${task.ref} · ${task.title}`,
    description: desc,
    openGraph: {
      title: `${task.ref} · ${task.title}`,
      description: desc,
      siteName: 'Verbivore Backstage',
      type: 'article',
      url: `/share/${task.ref}`
    },
    twitter: {
      card: 'summary_large_image',
      title: `${task.ref} · ${task.title}`,
      description: desc
    }
  }
}

export default function SharedTaskPage({
  params
}: {
  params: Params
}) {
  return (
    <Suspense fallback={null}>
      <SharedTaskContent params={params} />
    </Suspense>
  )
}

async function SharedTaskContent({ params }: { params: Params }) {
  const { ref } = await params
  const task = await fetchTaskByRef(ref)
  if (!task) notFound()

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAFAF7] px-4 py-8 sm:py-14 dark:bg-[#0E1414]">
      <BackgroundDecor />

      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center transition hover:opacity-80"
          >
            <Image
              src="/logos/verbivore-logo-horizontal.svg"
              alt="Verbivore"
              width={140}
              height={36}
              priority
              className="block h-7 w-auto dark:hidden"
            />
            <Image
              src="/logos/verbivore-logo-horizontal-white.svg"
              alt=""
              aria-hidden
              width={140}
              height={36}
              priority
              className="hidden h-7 w-auto dark:block"
            />
          </Link>
          <Link
            href={`/dashboard/board?project=${task.project.id}&task=${task.ref}`}
            prefetch={false}
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-[#00A89E] px-4 text-xs font-medium text-white shadow-sm transition hover:bg-[#018A82]"
          >
            Open in Backstage
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </header>

        <article className="flex flex-col gap-6 rounded-3xl border border-zinc-200/70 bg-white p-7 shadow-[0_1px_0_rgba(15,18,23,0.04),0_18px_50px_-24px_rgba(15,18,23,0.18)] sm:p-9 dark:border-white/10 dark:bg-[#161F1F] dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.18em] uppercase">
            <span className="rounded-md bg-[#00A89E]/10 px-2 py-0.5 font-medium tabular-nums text-[#018A82] dark:bg-[#00A89E]/15 dark:text-[#5DE1D6]">
              {task.ref}
            </span>
            <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <FolderKanban className="size-3" />
              {task.project.name}
            </span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <CalendarDays className="size-3" />
                Due {formatDate(task.dueDate)}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl leading-tight tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            {task.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {task.description}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-zinc-200/70 pt-6 sm:grid-cols-2 dark:border-white/10">
            <MemberCell label="Assignee" member={task.assignee} />
            <MemberCell label="Lead" member={task.lead} />
          </div>
        </article>

        <footer className="flex items-center justify-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-zinc-400 dark:text-zinc-600">
          <span className="size-1 rounded-full bg-[#00A89E]" />
          Shared from Verbivore Backstage
        </footer>
      </div>
    </main>
  )
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-[#00A89E]/12 blur-3xl dark:bg-[#00A89E]/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-500/10"
      />
    </>
  )
}

function MemberCell({
  label,
  member
}: {
  label: string
  member: {
    id: string
    fullName: string
    avatarUrl: string | null
    slug: string | null
  } | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {member ? (
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 align-middle text-[11px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            {member.avatarUrl ? (
              <Image
                src={member.avatarUrl}
                alt={member.fullName}
                fill
                sizes="32px"
                className="object-cover"
                unoptimized
              />
            ) : (
              initials(member.fullName)
            )}
          </span>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {member.fullName}
          </span>
        </div>
      ) : (
        <span className="text-sm text-zinc-400 dark:text-zinc-600">
          Unassigned
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.todo
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${palette}`}
    >
      <span
        className={`size-1.5 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.todo}`}
      />
      {labelForStatus(status)}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'none') return null
  const palette = PRIORITY_PALETTE[priority] ?? PRIORITY_PALETTE.medium
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${palette}`}
    >
      {capitalize(priority)} priority
    </span>
  )
}

const STATUS_PALETTE: Record<string, string> = {
  backlog: 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200',
  unscoped: 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200',
  todo: 'bg-zinc-900 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  in_review:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  canceled:
    'bg-zinc-100 text-zinc-500 line-through dark:bg-white/10 dark:text-zinc-400',
  duplicate:
    'bg-zinc-100 text-zinc-500 line-through dark:bg-white/10 dark:text-zinc-400'
}

const STATUS_DOT: Record<string, string> = {
  backlog: 'bg-zinc-400',
  unscoped: 'bg-zinc-400',
  todo: 'bg-zinc-50 dark:bg-zinc-900',
  in_progress: 'bg-sky-500',
  in_review: 'bg-amber-500',
  done: 'bg-emerald-500',
  canceled: 'bg-zinc-400',
  duplicate: 'bg-zinc-400'
}

const PRIORITY_PALETTE: Record<string, string> = {
  urgent:
    'border-red-300 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300',
  high: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300',
  medium:
    'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-200',
  low: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-500/20 dark:bg-zinc-500/5 dark:text-zinc-400'
}

function labelForStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}
