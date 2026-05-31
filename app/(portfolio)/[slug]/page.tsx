import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/supabase/server'
import { DEFAULT_LOGIN_ROUTE } from '@/routes'

type RouteParams = { slug: string }
type AccessTier = 'admin' | 'lead' | 'member'

type SkillEntry = { label: string; level: number }
type WorkLinkEntry = { label: string; url: string }

const ROLE_LABEL: Record<AccessTier, string> = {
  admin: 'Admin',
  lead: 'Lead',
  member: 'Member'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function parseSkills(value: unknown): SkillEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((s): SkillEntry | null => {
      if (!s || typeof s !== 'object') return null
      const obj = s as Record<string, unknown>
      const label = typeof obj.label === 'string' ? obj.label : null
      const level = typeof obj.level === 'number' ? obj.level : 0
      return label ? { label, level } : null
    })
    .filter((s): s is SkillEntry => s !== null)
}

function parseWorkLinks(value: unknown): WorkLinkEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((s): WorkLinkEntry | null => {
      if (!s || typeof s !== 'object') return null
      const obj = s as Record<string, unknown>
      const label = typeof obj.label === 'string' ? obj.label : null
      const url = typeof obj.url === 'string' ? obj.url : null
      return label && url ? { label, url } : null
    })
    .filter((s): s is WorkLinkEntry => s !== null)
}

export async function generateMetadata(props: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { slug } = await props.params
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_members')
    .select('full_name, headline, bio')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return { title: 'Portfolio · Verbivore' }
  return {
    title: `${data.full_name} · Verbivore`,
    description:
      data.headline ?? data.bio ?? `${data.full_name}'s portfolio on Verbivore.`
  }
}

export default function PortfolioSlugPage(props: {
  params: Promise<RouteParams>
}) {
  return (
    <main className="flex min-h-screen w-full flex-col bg-background text-foreground">
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

      <Suspense fallback={<PortfolioSkeleton />}>
        <PortfolioBody params={props.params} />
      </Suspense>
    </main>
  )
}

async function PortfolioBody({
  params
}: {
  params: Promise<RouteParams>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: claimsRes } = await supabase.auth.getClaims()
  const userId = claimsRes?.claims?.sub
  if (!userId) redirect(DEFAULT_LOGIN_ROUTE)

  const { data: target } = await supabase
    .from('team_members')
    .select(
      'id, company_id, slug, full_name, avatar_url, bio, headline, role_focus, work_style, work_links, skills, access_tier, languages, social_instagram, social_linkedin, social_whatsapp, contact_email'
    )
    .eq('slug', slug)
    .maybeSingle()
  if (!target) notFound()

  const { data: viewer } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()
  if (!viewer || viewer.company_id !== target.company_id) notFound()

  const [shippedRes, doneCountRes, projectsRes, sprintsRes] = await Promise.all(
    [
      supabase
        .from('tasks')
        .select('id, ref, title, updated_at, projects(name)')
        .eq('assignee_id', target.id)
        .eq('status', 'done')
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', target.id)
        .eq('status', 'done'),
      supabase
        .from('tasks')
        .select('project_id')
        .eq('assignee_id', target.id),
      supabase
        .from('sprint_tasks')
        .select('sprint_id, tasks!inner(assignee_id)')
        .eq('tasks.assignee_id', target.id)
    ]
  )

  const shipped = shippedRes.data ?? []
  const doneAllTime = doneCountRes.count ?? 0
  const projects = new Set(
    (projectsRes.data ?? []).map((r) => r.project_id)
  ).size
  const sprints = new Set(
    (sprintsRes.data ?? []).map((r) => r.sprint_id)
  ).size

  const skills = parseSkills(target.skills)
  const workLinks = parseWorkLinks(target.work_links)

  return (
    <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <IdentityCard
          name={target.full_name}
          role={ROLE_LABEL[target.access_tier as AccessTier]}
          roleFocus={target.role_focus}
          headline={target.headline}
          avatarUrl={target.avatar_url}
          bio={target.bio}
          slug={target.slug}
        />
        <StatsCard
          doneAllTime={doneAllTime}
          projects={projects}
          sprints={sprints}
        />
        <ContactCard
          contactEmail={target.contact_email}
          instagram={target.social_instagram}
          linkedin={target.social_linkedin}
          whatsapp={target.social_whatsapp}
          workLinks={workLinks}
        />
      </div>

      {skills.length > 0 && <SkillsRow skills={skills} />}

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex shrink-0 items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Recent shipped work
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Last {shipped.length} completed task{shipped.length === 1 ? '' : 's'}
          </span>
        </div>
        {shipped.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center text-xs text-muted-foreground">
            Nothing shipped yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shipped.map((task) => (
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
                  {task.projects?.name}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatDate(task.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {target.work_style && <WorkStyleRow text={target.work_style} />}
      <LanguagesRow languages={target.languages} />
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
      </div>
      <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
    </div>
  )
}

function IdentityCard({
  name,
  role,
  roleFocus,
  headline,
  avatarUrl,
  bio,
  slug
}: {
  name: string
  role: string
  roleFocus: string | null
  headline: string | null
  avatarUrl: string | null
  bio: string | null
  slug: string | null
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
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
            {roleFocus ?? role}
          </span>
        </div>
      </div>
      {headline && (
        <p className="text-xs font-medium leading-relaxed text-foreground">
          {headline}
        </p>
      )}
      <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
        {bio ?? 'No bio yet.'}
      </p>
      {slug && (
        <span className="text-[10px] tracking-[0.15em] text-muted-foreground/70 uppercase">
          /{slug}
        </span>
      )}
    </div>
  )
}

function StatsCard({
  doneAllTime,
  projects,
  sprints
}: {
  doneAllTime: number
  projects: number
  sprints: number
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-4">
      <Stat label="Shipped" value={doneAllTime} />
      <Stat label="Projects" value={projects} />
      <Stat label="Sprints" value={sprints} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-background px-3 py-2">
      <span className="text-2xl font-medium tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  )
}

function ContactCard({
  contactEmail,
  instagram,
  linkedin,
  whatsapp,
  workLinks
}: {
  contactEmail: string | null
  instagram: string | null
  linkedin: string | null
  whatsapp: string | null
  workLinks: WorkLinkEntry[]
}) {
  const links: { href: string; label: string }[] = []
  for (const link of workLinks) links.push({ href: link.url, label: link.label })
  if (instagram) links.push({ href: instagram, label: 'Instagram' })
  if (linkedin) links.push({ href: linkedin, label: 'LinkedIn' })
  if (whatsapp) links.push({ href: whatsapp, label: 'WhatsApp' })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Reach out
      </span>
      {contactEmail ? (
        <a
          href={`mailto:${contactEmail}`}
          className="truncate text-sm font-medium text-foreground transition hover:text-muted-foreground"
        >
          {contactEmail}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">
          No public contact email.
        </span>
      )}
      {links.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {links.map(({ href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground transition hover:text-muted-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillsRow({ skills }: { skills: SkillEntry[] }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
      <span className="mr-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Skills
      </span>
      {skills.map((s) => (
        <span
          key={s.label}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground"
        >
          {s.label}
          {s.level > 0 && (
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {'•'.repeat(s.level)}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function WorkStyleRow({ text }: { text: string }) {
  return (
    <div className="flex shrink-0 items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Works best
      </span>
      <p className="text-xs leading-relaxed text-foreground">{text}</p>
    </div>
  )
}

function LanguagesRow({ languages }: { languages: string[] }) {
  if (!languages || languages.length === 0) return null
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
      <span className="mr-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Speaks
      </span>
      {languages.map((lang) => (
        <span
          key={lang}
          className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground"
        >
          {lang}
        </span>
      ))}
    </div>
  )
}
