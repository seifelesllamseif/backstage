'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AtSign, Briefcase, Mail, MessageCircle, Link2 } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from 'radix-ui'
import Avatar from './Avatar'
import { useTeam } from './TeamContext'
import { getPresence, PRESENCE_LABEL } from './presence'
import { useDashTheme } from './theme'
import { fetchMemberPortfolio } from '../actions'

// Lightweight side-panel view of a teammate: avatar, name, presence,
// role / focus, headline, bio, timezone, languages, skills, socials, and
// work links. Read-only. Opened from the sidebar team list via right-
// click -> View profile.

export interface MemberPortfolio {
  id: string
  fullName: string
  avatarUrl: string | null
  accessTier: 'admin' | 'lead' | 'member'
  bio: string | null
  contactEmail: string | null
  headline: string | null
  roleFocus: string | null
  timezone: string | null
  workStyle: string | null
  languages: string[]
  socialLinkedin: string | null
  socialInstagram: string | null
  socialWhatsapp: string | null
  workLinks: { label: string; url: string }[]
  skills: { label: string; level: number }[]
}

interface Ctx {
  open: (memberId: string) => void
}

const PortfolioCtx = createContext<Ctx | null>(null)

export function usePortfolioSheet(): Ctx {
  const ctx = useContext(PortfolioCtx)
  if (!ctx) throw new Error('usePortfolioSheet outside <PortfolioSheetProvider>')
  return ctx
}

export function PortfolioSheetProvider({
  children
}: {
  children: React.ReactNode
}) {
  const team = useTeam()
  const { t } = useDashTheme()
  const [openId, setOpenId] = useState<string | null>(null)
  const [data, setData] = useState<MemberPortfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback((memberId: string) => {
    setOpenId(memberId)
  }, [])

  useEffect(() => {
    if (!openId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMemberPortfolio(openId)
      .then((res) => {
        if (cancelled) return
        if ('error' in res) {
          setError(res.error ?? 'Failed to load profile.')
          setData(null)
        } else {
          setData(res.member)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [openId])

  const assignee = openId ? team.find((m) => m.id === openId) : null
  const presence = assignee ? getPresence(assignee) : null

  return (
    <PortfolioCtx.Provider value={{ open }}>
      {children}
      <Sheet
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) setOpenId(null)
        }}
      >
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className={`w-full p-0 sm:max-w-100! ${t.detail}`}
        >
          <VisuallyHidden.Root>
            <SheetTitle>{assignee?.name ?? 'Teammate profile'}</SheetTitle>
          </VisuallyHidden.Root>

          <div className="flex h-full flex-col overflow-y-auto">
            <div
              className={`flex items-center gap-2.5 border-b px-4 py-3 ${t.border}`}
            >
              {assignee && (
                <Avatar user={assignee} size={40} showPresence />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <h2
                  className={`truncate text-sm leading-tight font-medium ${t.text}`}
                >
                  {assignee?.name ?? '...'}
                </h2>
                {presence && (
                  <span className={`text-[10px] ${t.textMuted}`}>
                    {PRESENCE_LABEL[presence]}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3.5 px-4 py-4">
              {loading && (
                <p className={`text-[11px] ${t.textMuted}`}>
                  Loading profile...
                </p>
              )}
              {error && (
                <p className="text-[11px] text-red-500">{error}</p>
              )}
              {data && (
                <>
                  {data.headline && (
                    <p className={`text-xs leading-relaxed ${t.text}`}>
                      {data.headline}
                    </p>
                  )}
                  {data.bio && (
                    <p
                      className={`text-[11px] leading-relaxed whitespace-pre-wrap ${t.text}`}
                    >
                      {data.bio}
                    </p>
                  )}

                  <Facts t={t} portfolio={data} />

                  {data.skills.length > 0 && (
                    <Section title="Skills" t={t}>
                      <div className="flex flex-wrap gap-1">
                        {data.skills.map((s) => (
                          <span
                            key={s.label}
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] ${t.tab}`}
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {data.workLinks.length > 0 && (
                    <Section title="Work links" t={t}>
                      <div className="flex flex-col gap-1">
                        {data.workLinks.map((l) => (
                          <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1.5 text-[11px] hover:underline ${t.text}`}
                          >
                            <Link2 className="size-3 shrink-0" />
                            <span className="truncate">
                              {l.label || l.url}
                            </span>
                          </a>
                        ))}
                      </div>
                    </Section>
                  )}

                  <Socials portfolio={data} t={t} />
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PortfolioCtx.Provider>
  )
}

function Section({
  title,
  t,
  children
}: {
  title: string
  t: ReturnType<typeof useDashTheme>['t']
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

function Facts({
  portfolio,
  t
}: {
  portfolio: MemberPortfolio
  t: ReturnType<typeof useDashTheme>['t']
}) {
  const rows: { label: string; value: string }[] = []
  if (portfolio.roleFocus) rows.push({ label: 'Focus', value: portfolio.roleFocus })
  if (portfolio.timezone) rows.push({ label: 'Time zone', value: portfolio.timezone })
  if (portfolio.workStyle) rows.push({ label: 'How they work', value: portfolio.workStyle })
  if (portfolio.languages.length)
    rows.push({ label: 'Languages', value: portfolio.languages.join(', ') })
  if (rows.length === 0) return null
  return (
    <dl className="grid grid-cols-[72px_1fr] gap-y-1 text-[11px]">
      {rows.map((r) => (
        <FactRow key={r.label} label={r.label} value={r.value} t={t} />
      ))}
    </dl>
  )
}

function FactRow({
  label,
  value,
  t
}: {
  label: string
  value: string
  t: ReturnType<typeof useDashTheme>['t']
}) {
  return (
    <>
      <dt className={`text-[9px] tracking-wider uppercase ${t.textMuted}`}>
        {label}
      </dt>
      <dd className={`text-[11px] leading-relaxed ${t.text}`}>{value}</dd>
    </>
  )
}

function Socials({
  portfolio,
  t
}: {
  portfolio: MemberPortfolio
  t: ReturnType<typeof useDashTheme>['t']
}) {
  const items: { key: string; href: string; icon: React.ReactNode; label: string }[] = []
  if (portfolio.contactEmail) {
    items.push({
      key: 'email',
      href: `mailto:${portfolio.contactEmail}`,
      icon: <Mail className="size-3" />,
      label: portfolio.contactEmail
    })
  }
  if (portfolio.socialWhatsapp) {
    items.push({
      key: 'wa',
      href: portfolio.socialWhatsapp,
      icon: <MessageCircle className="size-3" />,
      label: 'WhatsApp'
    })
  }
  if (portfolio.socialLinkedin) {
    items.push({
      key: 'li',
      href: portfolio.socialLinkedin,
      icon: <Briefcase className="size-3" />,
      label: 'LinkedIn'
    })
  }
  if (portfolio.socialInstagram) {
    items.push({
      key: 'ig',
      href: portfolio.socialInstagram,
      icon: <AtSign className="size-3" />,
      label: 'Instagram'
    })
  }
  if (items.length === 0) return null
  return (
    <Section title="Reach out" t={t}>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target={item.href.startsWith('mailto:') ? '_self' : '_blank'}
            rel="noreferrer"
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition ${t.border} ${t.tab}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </Section>
  )
}
