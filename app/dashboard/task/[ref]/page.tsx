import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { fetchTaskByRef } from '@/supabase/dashboard/fetchTaskByRef'

type Params = Promise<{ ref: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { ref } = await params
  const task = await fetchTaskByRef(ref)
  if (!task) {
    return { title: `${ref} · Verbivore`, description: 'Task not found.' }
  }
  const desc = `${task.project.name} · ${labelForStatus(task.status)} · ${task.title}`
  return {
    title: `${task.ref} · ${task.title} · Verbivore`,
    description: desc,
    openGraph: {
      title: `${task.ref} · ${task.title}`,
      description: desc,
      type: 'article'
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
    <main className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <Link
            href="/dashboard/board"
            className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
          <Link
            href={`/dashboard/board?project=${task.project.id}`}
            className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Open in board
            <ArrowUpRight className="size-3.5" />
          </Link>
        </header>

        <article className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {task.ref}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span>{task.project.name}</span>
            {task.dueDate && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>Due {formatDate(task.dueDate)}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            {task.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {task.description}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-2 dark:border-white/10">
            <MemberCell label="Assignee" member={task.assignee} />
            <MemberCell label="Lead" member={task.lead} />
          </div>
        </article>

        <footer className="text-center text-[11px] text-zinc-400 dark:text-zinc-600">
          Verbivore · internal task share
        </footer>
      </div>
    </main>
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
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {member ? (
        <div className="flex items-center gap-2">
          {member.avatarUrl ? (
            <span className="relative inline-block size-7 overflow-hidden rounded-full">
              <Image
                src={member.avatarUrl}
                alt={member.fullName}
                fill
                sizes="28px"
                className="object-cover"
              />
            </span>
          ) : (
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              {initials(member.fullName)}
            </span>
          )}
          <span className="text-sm text-zinc-900 dark:text-zinc-100">
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${palette}`}
    >
      {labelForStatus(status)}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'none') return null
  const palette = PRIORITY_PALETTE[priority] ?? PRIORITY_PALETTE.medium
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${palette}`}
    >
      {capitalize(priority)} priority
    </span>
  )
}

const STATUS_PALETTE: Record<string, string> = {
  backlog: 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200',
  unscoped: 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200',
  todo: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  in_review:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  canceled:
    'bg-zinc-100 text-zinc-500 line-through dark:bg-white/10 dark:text-zinc-400',
  duplicate:
    'bg-zinc-100 text-zinc-500 line-through dark:bg-white/10 dark:text-zinc-400'
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
