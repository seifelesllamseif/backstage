// Contribution log + Redeployment history + Crew profile assembly.

// ---------- Contribution log --------------------------------------------
function ContributionLog({ contributions, prominent = false }) {
  if (!contributions || contributions.length === 0) {
    return (
      <Card>
        <SectionHeader title="Contribution log" />
        <EmptyState
          message="Nothing shipped yet. Completed work will collect here over time."
          dense
        />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeader
        title="Contribution log"
        meta={`${contributions.length} item${contributions.length === 1 ? '' : 's'} · ${
          prominent ? 'near-final for exit summary' : 'completed work'
        }`}
      />
      <div>
        {contributions.map((c, i) => (
          <ContributionRow key={i} item={c} first={i === 0} />
        ))}
      </div>
    </Card>
  );
}

function ContributionRow({ item, first }) {
  const kind = item.kind || 'task';
  const KIND_LABEL = {
    task:      { label: 'Task',      color: SKAM.text2 },
    milestone: { label: 'Milestone', color: SKAM.info  },
    project:   { label: 'Project',   color: SKAM.success },
  };
  const k = KIND_LABEL[kind];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr auto auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 20px',
        borderTop: first ? `0.5px solid ${SKAM.divider}` : `0.5px solid ${SKAM.divider}`,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: k.color }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: k.color }} />
        {k.label}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: SKAM.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 2 }}>{item.subtitle}</div>
        )}
      </div>
      <ProjectTag name={item.project} />
      <span style={{ fontSize: 11, color: SKAM.textMuted, fontVariantNumeric: 'tabular-nums' }}>
        {item.date}
      </span>
    </div>
  );
}

// ---------- Redeployment history ----------------------------------------
function RedeploymentHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <SectionHeader title="Redeployment history" />
        <EmptyState message="No moves yet." dense />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeader title="Redeployment history" meta={`${history.length} move${history.length === 1 ? '' : 's'}`} />
      <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.map((h, i) => (
          <div
            key={i}
            style={{
              background: SKAM.inset,
              border: `0.5px solid ${SKAM.divider}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 11, color: SKAM.textMuted, fontVariantNumeric: 'tabular-nums', flex: '0 0 78px' }}>
              {h.date}
            </span>
            <span style={{ fontSize: 12, color: SKAM.text2 }}>{h.from}</span>
            <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"/>
              </svg>
            </span>
            <span style={{ fontSize: 12, color: SKAM.text, fontWeight: 500 }}>{h.to}</span>
            <span style={{ flex: 1, fontSize: 12, color: SKAM.text2 }}>{h.reason}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Crew profile assembly ---------------------------------------
function CrewProfile({ profile, viewerIsSelf = false }) {
  const stage = profile.stage;
  const isAlumni = stage === 'alumni';

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <ProfileHeader profile={profile} viewerIsSelf={viewerIsSelf} />

      {/* Stage-specific banner */}
      {stage === 'incoming' && (
        <StageBanner
          tone="info"
          title={`Starts ${profile.startDate}`}
          body="Onboarding hasn't begun yet. Allocation, tasks, and contribution log will populate from day one."
          action={<Button variant="secondary">Open onboarding plan</Button>}
        />
      )}
      {stage === 'wrapping_up' && (
        <StageBanner
          tone="warning"
          title={`Wraps up in ${profile.daysLeft} days`}
          body="The contribution log is close to final. Generate an exit summary when ready — it pulls from the log, allocations, and redeployment history."
          action={<Button variant="primary">Generate exit summary</Button>}
        />
      )}
      {stage === 'alumni' && (
        <StageBanner
          tone="muted"
          title="Alumni"
          body="This profile is read-only. The record below was final on the last day of contract."
          action={<Button variant="secondary">View exit summary</Button>}
        />
      )}

      <SkillsSection skills={profile.skills} />
      <AvailabilitySection availability={profile.availability} />

      {!isAlumni && <AllocationsSection allocations={profile.allocations} />}

      <ContributionLog contributions={profile.contributions} prominent={stage === 'wrapping_up'} />

      {profile.redeploymentHistory && profile.redeploymentHistory.length > 0 && (
        <RedeploymentHistory history={profile.redeploymentHistory} />
      )}
    </div>
  );
}

function StageBanner({ tone, title, body, action }) {
  const TONE = {
    info:    { color: SKAM.info,    bg: SKAM.infoTint    },
    warning: { color: SKAM.warning, bg: SKAM.warningTint },
    muted:   { color: SKAM.text2,   bg: SKAM.mutedTint   },
  };
  const t = TONE[tone];
  return (
    <div
      style={{
        background: t.bg,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.color, flex: '0 0 auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: SKAM.text, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12, color: SKAM.text2, marginTop: 3, lineHeight: 1.5 }}>{body}</div>
      </div>
      {action}
    </div>
  );
}

Object.assign(window, { ContributionLog, RedeploymentHistory, CrewProfile });
