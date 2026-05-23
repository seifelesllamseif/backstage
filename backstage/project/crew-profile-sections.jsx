// Crew profile — Skills + Availability + Allocations sections.

// ---------- Skills -------------------------------------------------------
function SkillsSection({ skills }) {
  return (
    <Card>
      <SectionHeader title="Skills" meta="primary role + secondary" />
      <div style={{ padding: '0 20px 18px 20px' }}>
        {/* Primary */}
        <div
          style={{
            background: SKAM.inset,
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 4 }}>Primary role</div>
            <div style={{ fontSize: 15, color: SKAM.text, fontWeight: 500, letterSpacing: '-0.005em' }}>
              {skills.primary.name}
            </div>
            {skills.primary.note && (
              <div style={{ fontSize: 12, color: SKAM.text2, marginTop: 4, lineHeight: 1.45 }}>
                {skills.primary.note}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <SkillDots level={skills.primary.level} />
            <span style={{ fontSize: 11, color: SKAM.text2 }}>
              {SKILL_LEVELS[skills.primary.level - 1]}
            </span>
          </div>
        </div>

        {/* Secondary skills, grouped by family */}
        {skills.secondaryGroups.length === 0 ? (
          <EmptyState
            message="No secondary skills logged yet. They'll appear as the person adds them."
            dense
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {skills.secondaryGroups.map((g, i) => (
              <SkillGroup key={i} group={g} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function SkillGroup({ group }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 8 }}>
        {group.family}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {group.skills.map((s, i) => (
          <SkillRow key={i} skill={s} />
        ))}
      </div>
    </div>
  );
}

function SkillRow({ skill }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        border: `0.5px solid ${SKAM.divider}`,
        borderRadius: 8,
        background: SKAM.card,
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: SKAM.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {skill.name}
      </span>
      <SkillDots level={skill.level} />
    </div>
  );
}

// ---------- Availability -------------------------------------------------
function AvailabilitySection({ availability }) {
  return (
    <Card>
      <SectionHeader title="Availability" />
      <div
        style={{
          padding: '0 20px 18px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <KV label="Start date" value={availability.start} />
        <KV label="End date"   value={availability.end} accent={availability.endAccent} />
        <KV label="Work mode"  value={availability.mode} />
        <KV label="Weekly capacity" value={`${availability.weekly}h / wk`} />
      </div>
    </Card>
  );
}

function KV({ label, value, accent }) {
  return (
    <div
      style={{
        background: SKAM.inset,
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, color: SKAM.textMuted }}>{label}</span>
      <span style={{ fontSize: 14, color: accent === 'warning' ? SKAM.warning : SKAM.text, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

// ---------- Allocations --------------------------------------------------
// Reuses the same split-bar idiom as the Cockpit allocation card.
function AllocationsSection({ allocations }) {
  if (!allocations || allocations.projects.length === 0) {
    return (
      <Card>
        <SectionHeader title="Current allocations" />
        <EmptyState message="Not allocated to any project right now." dense />
      </Card>
    );
  }
  const total = allocations.total;
  const over = total > 100;
  const cap = Math.max(total, 100);

  return (
    <Card>
      <SectionHeader title="Current allocations" meta={`${allocations.projects.length} project${allocations.projects.length === 1 ? '' : 's'}`} />
      <div style={{ padding: '0 20px 18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: over ? SKAM.red : SKAM.text, letterSpacing: '-0.02em' }}>
              {total}%
            </span>
            <span style={{ fontSize: 12, color: SKAM.textMuted }}>this week</span>
          </div>
        </div>
        <ProgressBar
          segments={allocations.projects.map((p) => ({
            value: (p.percent / cap) * 100,
            color: p.color,
            title: `${p.project} ${p.percent}%`,
          }))}
          height={6}
        />
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allocations.projects.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color, flex: '0 0 auto' }} />
              <ProjectTag name={p.project} />
              <span style={{ color: SKAM.text2, flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.role}
              </span>
              <span style={{ color: SKAM.text2, fontVariantNumeric: 'tabular-nums' }}>{p.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { SkillsSection, AvailabilitySection, AllocationsSection });
