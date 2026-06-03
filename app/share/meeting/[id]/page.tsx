import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowUpRight, CalendarDays, Clock, Video } from 'lucide-react'
import { fetchMeetingForShare, type SharedMeeting } from '@/supabase/dashboard/meetings'

/* eslint-disable @next/next/no-img-element */

type Params = Promise<{ id: string }>

function describeAttendees(m: SharedMeeting): string {
  if (m.attendees.length === 0) return 'someone'
  if (m.attendees.length === 1) return m.attendees[0].fullName
  return `${m.attendees[0].fullName} + ${m.attendees.length - 1} more`
}

function descriptionFor(m: SharedMeeting): string {
  const when = formatWhen(m)
  const who = `${m.requesterName} ↔ ${describeAttendees(m)}`
  // Completed meetings lead with the outcome - more useful in a
  // WhatsApp preview than the date now in the past.
  if (m.status === 'completed' && m.outcome) {
    const outcomeLabel: Record<NonNullable<SharedMeeting['outcome']>, string> = {
      resolved: 'Resolved',
      partial: 'Partial',
      needs_followup: 'Needs follow-up',
      failed: "Didn't deliver"
    }
    return `${outcomeLabel[m.outcome]} · ${who}`
  }
  return when ? `${who} · ${when}` : who
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const meeting = await fetchMeetingForShare(id)
  if (!meeting) {
    return {
      title: 'Meeting · Verbivore',
      description: 'Meeting not found on Verbivore Backstage.'
    }
  }
  const desc = descriptionFor(meeting)
  return {
    title: `${meeting.title} · Verbivore`,
    description: desc,
    openGraph: {
      title: meeting.title,
      description: desc,
      siteName: 'Verbivore Backstage',
      type: 'article',
      url: `/share/meeting/${meeting.id}`
    },
    twitter: {
      card: 'summary_large_image',
      title: meeting.title,
      description: desc
    }
  }
}

export default function SharedMeetingPage({
  params
}: {
  params: Params
}) {
  return (
    <Suspense fallback={null}>
      <SharedMeetingContent params={params} />
    </Suspense>
  )
}

async function SharedMeetingContent({ params }: { params: Params }) {
  const { id } = await params
  const meeting = await fetchMeetingForShare(id)
  if (!meeting) notFound()

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
            href={`/dashboard?meetings=${meeting.id}`}
            prefetch={false}
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-[#00A89E] px-4 text-xs font-medium text-white shadow-sm transition hover:bg-[#018A82]"
          >
            Open in Backstage
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </header>

        <article className="flex flex-col gap-6 rounded-3xl border border-zinc-200/70 bg-white p-7 shadow-[0_1px_0_rgba(15,18,23,0.04),0_18px_50px_-24px_rgba(15,18,23,0.18)] sm:p-9 dark:border-white/10 dark:bg-[#161F1F] dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.18em] uppercase">
            <StatusBadge status={meeting.status} />
            <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Clock className="size-3" />
              {meeting.durationMin} min
            </span>
            {(meeting.selectedStartsAt || meeting.proposedDate) && (
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <CalendarDays className="size-3" />
                {formatWhen(meeting)}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl leading-tight tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            {meeting.title}
          </h1>

          {meeting.meetLink && !isOver(meeting) && (
            <a
              href={meeting.meetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-[#00A89E] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#018A82]"
            >
              <Video className="size-4" />
              Join Google Meet
            </a>
          )}
          {isOver(meeting) && (
            <span className="inline-flex w-fit items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-500 dark:border-white/15 dark:text-zinc-400">
              This meeting has ended.
            </span>
          )}

          <div className="grid grid-cols-1 gap-4 border-t border-zinc-200/70 pt-6 sm:grid-cols-2 dark:border-white/10">
            <MemberCell
              label="Organizer"
              name={meeting.requesterName}
              avatarUrl={meeting.requesterAvatarUrl}
            />
            <MemberCell
              label={meeting.attendees.length > 1 ? 'Attendees' : 'With'}
              name={describeAttendees(meeting)}
              avatarUrl={meeting.attendees[0]?.avatarUrl ?? null}
            />
          </div>

          {meeting.status === 'completed' && meeting.outcome && (
            <RecapBlock
              outcome={meeting.outcome}
              notes={meeting.reviewNotes}
              reviewedAt={meeting.reviewedAt}
            />
          )}

          {(meeting.goal ||
            meeting.context ||
            meeting.questions ||
            meeting.agenda) && (
            <div className="flex flex-col gap-3 border-t border-zinc-200/70 pt-6 dark:border-white/10">
              {meeting.goal && (
                <BriefBlock label="Goal" body={meeting.goal} />
              )}
              {meeting.context && (
                <BriefBlock label="Context" body={meeting.context} />
              )}
              {meeting.questions && (
                <BriefBlock label="Questions" body={meeting.questions} />
              )}
              {meeting.agenda && (
                <BriefBlock label="Agenda" body={meeting.agenda} />
              )}
            </div>
          )}

          {meeting.mode === 'slots' &&
            meeting.slots &&
            meeting.slots.length > 0 &&
            !meeting.selectedStartsAt && (
              <div className="flex flex-col gap-2 border-t border-zinc-200/70 pt-6 dark:border-white/10">
                <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
                  Proposed slots
                </span>
                <ul className="flex flex-col gap-1.5">
                  {meeting.slots.map((iso) => (
                    <li
                      key={iso}
                      className="text-sm tabular-nums text-zinc-700 dark:text-zinc-200"
                    >
                      {formatSlotLabel(iso)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {meeting.preRead && (
            <div className="flex flex-col gap-2 border-t border-zinc-200/70 pt-6 dark:border-white/10">
              <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
                Pre-read
              </span>
              <ul className="flex flex-col gap-1.5">
                {splitPreReadLinks(meeting.preRead).map((url, i) => (
                  <li key={`${url}-${i}`} className="flex items-center gap-1.5">
                    <ArrowUpRight className="size-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-sm text-[#018A82] hover:underline dark:text-[#3EE0D5]"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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

const OUTCOME_LABEL: Record<NonNullable<SharedMeeting['outcome']>, string> = {
  resolved: 'Resolved',
  partial: 'Partial',
  needs_followup: 'Needs follow-up',
  failed: "Didn't deliver"
}

const OUTCOME_TONE: Record<NonNullable<SharedMeeting['outcome']>, string> = {
  resolved:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30',
  partial:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30',
  needs_followup:
    'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500/30',
  failed:
    'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/30'
}

function RecapBlock({
  outcome,
  notes,
  reviewedAt
}: {
  outcome: NonNullable<SharedMeeting['outcome']>
  notes: string | null
  reviewedAt: string | null
}) {
  // notes is stored as either a raw "why" body or
  //   <why>\n\nNext steps:\n<steps>
  // (see ReviewForm.submit). Split it cleanly so the page surfaces
  // both sections instead of dumping the marker line.
  const { why, nextSteps } = splitRecapNotes(notes)
  const reviewedAtLabel = (() => {
    if (!reviewedAt) return null
    try {
      const d = new Date(reviewedAt)
      if (Number.isNaN(d.getTime())) return null
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return null
    }
  })()
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#00A89E]/30 bg-[#00A89E]/5 p-4 dark:border-[#00A89E]/30 dark:bg-[#00A89E]/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
          Recap
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${OUTCOME_TONE[outcome]}`}
        >
          {OUTCOME_LABEL[outcome]}
        </span>
      </div>
      {why && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">
          {why}
        </p>
      )}
      {nextSteps && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
            Next steps
          </span>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
            {nextSteps}
          </p>
        </div>
      )}
      {reviewedAtLabel && (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Reviewed {reviewedAtLabel}
        </span>
      )}
    </div>
  )
}

function splitRecapNotes(raw: string | null): {
  why: string
  nextSteps: string
} {
  if (!raw) return { why: '', nextSteps: '' }
  const marker = '\n\nNext steps:\n'
  const idx = raw.indexOf(marker)
  if (idx === -1) return { why: raw.trim(), nextSteps: '' }
  return {
    why: raw.slice(0, idx).trim(),
    nextSteps: raw.slice(idx + marker.length).trim()
  }
}

function BriefBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
        {body}
      </p>
    </div>
  )
}

function splitPreReadLinks(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatSlotLabel(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return iso
  }
}

function MemberCell({
  label,
  name,
  avatarUrl
}: {
  label: string
  name: string
  avatarUrl: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            width={32}
            height={32}
            loading="lazy"
            className="size-8 shrink-0 rounded-full object-cover align-middle"
          />
        ) : (
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 align-middle text-[11px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            {initials(name)}
          </span>
        )}
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {name}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: SharedMeeting['status'] }) {
  const label = STATUS_LABEL[status] ?? status
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${palette}`}
    >
      {label}
    </span>
  )
}

const STATUS_LABEL: Record<SharedMeeting['status'], string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  completed: 'Completed',
  rejected: 'Rejected',
  declined: 'Declined',
  canceled: 'Canceled'
}

const STATUS_PALETTE: Record<SharedMeeting['status'], string> = {
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  approved:
    'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  scheduled:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  completed:
    'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200',
  rejected: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400',
  declined: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400',
  canceled: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function isOver(m: SharedMeeting): boolean {
  if (!m.selectedStartsAt) return false
  const ends =
    new Date(m.selectedStartsAt).getTime() + m.durationMin * 60_000
  return ends < Date.now()
}

function formatWhen(m: SharedMeeting): string {
  if (m.status === 'scheduled' && m.selectedStartsAt) {
    try {
      return new Date(m.selectedStartsAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return m.selectedStartsAt
    }
  }
  if (m.proposedDate) {
    try {
      return new Date(`${m.proposedDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return m.proposedDate
    }
  }
  return ''
}
