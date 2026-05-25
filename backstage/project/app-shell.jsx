// AppShell — persistent left sidebar + top bar. Reused on every page so the
// cockpit (and later pages) read in product context.

// The full nav structure. One source of truth — every page reads from this.
const NAV = [
  {
    key: 'cockpit',
    label: 'Cockpit',
    href: 'Crew Cockpit.html',
    iconKey: 'cockpit'
  },
  {
    key: 'projects',
    label: 'Projects',
    href: 'Project Workspace.html',
    iconKey: 'projects'
  },
  {
    key: 'crew',
    label: 'Crew',
    iconKey: 'crew',
    children: [
      { key: 'crew-board', label: 'Crew Board', href: 'Crew Board.html' },
      { key: 'profile', label: 'Profiles', href: 'Crew Profile.html' },
      {
        key: 'onboarding',
        label: 'Onboarding',
        href: 'Onboarding Tracker.html'
      },
      { key: 'spotlight', label: 'Spotlight', href: 'Spotlight.html' }
    ]
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    iconKey: 'knowledge',
    children: [
      { key: 'kb', label: 'Knowledge base', href: 'Knowledge Base.html' },
      { key: 'assistant', label: 'Assistant', href: 'AI Assistant.html' }
    ]
  },
  { key: 'vault', label: 'Vault', href: 'Vault.html', iconKey: 'vault' }
]

function NavItem({ label, icon, active = false, href, sub = false }) {
  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: sub ? '6px 10px 6px 30px' : '7px 10px',
    borderRadius: 8,
    color: active ? SKAM.text : SKAM.text2,
    background: active ? SKAM.inset : 'transparent',
    fontSize: sub ? 12 : 13,
    fontWeight: 400,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background .12s, color .12s'
  }
  const inner = (
    <React.Fragment>
      {!sub && (
        <span
          style={{
            display: 'inline-flex',
            width: 14,
            justifyContent: 'center',
            color: active ? SKAM.text : SKAM.textMuted
          }}
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
    </React.Fragment>
  )
  return href ? (
    <a href={href} style={style}>
      {inner}
    </a>
  ) : (
    <div style={style}>{inner}</div>
  )
}

const NavIcons = {
  cockpit: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 7.5L8 2.5L14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5z" />
    </svg>
  ),
  projects: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11" />
    </svg>
  ),
  crew: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6.5" r="2.2" />
      <path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
      <circle cx="11.5" cy="5.5" r="1.6" />
      <path d="M14 11.5c0-1.6-1.2-2.5-2.5-2.5" />
    </svg>
  ),
  knowledge: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3h7.5a2.5 2.5 0 0 1 2.5 2.5V13H5a2 2 0 0 1-2-2V3z" />
      <path d="M3 11a2 2 0 0 1 2-2h8" />
    </svg>
  ),
  vault: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function Sidebar({ active = 'cockpit', subActive, user }) {
  return (
    <aside
      style={{
        width: 216,
        flex: '0 0 216px',
        height: '100%',
        background: SKAM.bg,
        borderRight: `0.5px solid ${SKAM.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 12px'
      }}
    >
      {/* company switcher slot — links back to the index landing */}
      <a
        href="index.html"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px 6px 8px',
          marginBottom: 18,
          borderRadius: 8,
          textDecoration: 'none'
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: SKAM.red,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em'
          }}
        >
          S
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            flex: 1
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: SKAM.text,
              fontWeight: 500,
              lineHeight: 1.2
            }}
          >
            Verbivorestudio
          </span>
          <span
            style={{ fontSize: 10, color: SKAM.textMuted, lineHeight: 1.2 }}
          >
            Crew OS
          </span>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke={SKAM.textMuted}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 5L6 7.5L8.5 5" />
        </svg>
      </a>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => {
          const isActive = item.key === active
          return (
            <React.Fragment key={item.key}>
              <NavItem
                label={item.label}
                icon={NavIcons[item.iconKey]}
                active={isActive}
                href={item.href || (item.children && item.children[0].href)}
              />
              {isActive && item.children && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    marginBottom: 4,
                    marginTop: 2
                  }}
                >
                  {item.children.map((c) => (
                    <NavItem
                      key={c.key}
                      label={c.label}
                      active={c.key === subActive}
                      href={c.href}
                      sub
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* current user pinned to the bottom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 8px',
          borderTop: `0.5px solid ${SKAM.divider}`,
          marginTop: 8,
          paddingTop: 12
        }}
      >
        <PersonChip name={user.name} self size="sm" />
      </div>
    </aside>
  )
}

function TopBar({ title = 'Cockpit', subtitle, crumbs }) {
  return (
    <header
      style={{
        height: 52,
        flex: '0 0 52px',
        borderBottom: `0.5px solid ${SKAM.border}`,
        background: SKAM.bg,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          minWidth: 0
        }}
      >
        {crumbs ? (
          <React.Fragment>
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <span
                  style={{
                    fontSize: 13,
                    color: i === crumbs.length - 1 ? SKAM.text : SKAM.text2,
                    fontWeight: i === crumbs.length - 1 ? 500 : 400
                  }}
                >
                  {c}
                </span>
                {i < crumbs.length - 1 && (
                  <span style={{ fontSize: 12, color: SKAM.textDim }}>/</span>
                )}
              </React.Fragment>
            ))}
          </React.Fragment>
        ) : (
          <span style={{ fontSize: 13, color: SKAM.text, fontWeight: 500 }}>
            {title}
          </span>
        )}
        {subtitle && (
          <span style={{ fontSize: 12, color: SKAM.textMuted }}>
            · {subtitle}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.border}`,
          borderRadius: 8,
          padding: '6px 10px',
          width: 280,
          color: SKAM.textMuted,
          fontSize: 12
        }}
      >
        {Icon.search}
        <span>Search people, projects, docs…</span>
        <span style={{ flex: 1 }} />
        <span
          style={{ fontSize: 10, color: SKAM.textDim, letterSpacing: '0.04em' }}
        >
          ⌘K
        </span>
      </div>
    </header>
  )
}

function AppShell({
  children,
  user,
  topbarSubtitle,
  active = 'cockpit',
  subActive,
  topbarTitle,
  topbarCrumbs
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: SKAM.bg,
        color: SKAM.text,
        fontFamily:
          '"Geist", "Geist Sans", -apple-system, system-ui, sans-serif',
        fontFeatureSettings: '"ss01", "cv11"'
      }}
    >
      <Sidebar active={active} subActive={subActive} user={user} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}
      >
        <TopBar
          title={topbarTitle}
          subtitle={topbarSubtitle}
          crumbs={topbarCrumbs}
        />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            background: SKAM.bg
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

Object.assign(window, { AppShell })
