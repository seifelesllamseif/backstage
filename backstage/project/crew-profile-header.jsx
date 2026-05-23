// Crew profile — one person's full record (§6.4).
// Sections: header, skills (primary + secondary, with levels), availability,
// current allocations, contribution log, redeployment history.

// ---------- Lifecycle pill ----------------------------------------------
// Reused on header. Names the lifecycle stage; colors live in the existing
// status palette so we don't introduce a new one.
const LIFECYCLE = {
  incoming:    { label: 'Incoming',    tint: 'mutedTint', color: 'text2'    },
  active:      { label: 'Active',      tint: 'successTint', color: 'success'  },
  wrapping_up: { label: 'Wrapping up', tint: 'warningTint', color: 'warning'  },
  alumni:      { label: 'Alumni',      tint: 'mutedTint', color: 'textMuted' },
};

function LifecyclePill({ stage }) {
  const s = LIFECYCLE[stage];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        padding: '4px 10px',
        borderRadius: 999,
        background: SKAM[s.tint],
        color: SKAM[s.color],
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM[s.color] }} />
      {s.label}
    </span>
  );
}

// ---------- Skill level dots --------------------------------------------
// Four levels: Learning, Capable, Proficient, Lead. One shape across every
// skill — primary, secondary, anywhere.
const SKILL_LEVELS = ['Learning', 'Capable', 'Proficient', 'Lead'];

function SkillDots({ level, max = 4 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }} title={SKILL_LEVELS[level - 1]}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: i < level ? SKAM.text : SKAM.divider,
          }}
        />
      ))}
    </span>
  );
}

// ---------- Profile header ----------------------------------------------
function ProfileHeader({ profile, viewerIsSelf }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '8px 4px 4px 4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <PersonChip name={profile.name} self={viewerIsSelf} size="lg" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: SKAM.textMuted }}>
          {profile.role} · {profile.contract} · {profile.pronouns}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LifecyclePill stage={profile.stage} />
          {profile.stage !== 'alumni' && profile.tenure && (
            <span style={{ fontSize: 12, color: SKAM.text2 }}>
              <span style={{ color: SKAM.text }}>{profile.tenure.label}</span>
              <span style={{ color: SKAM.textDim, margin: '0 6px' }}>·</span>
              <span style={{ color: SKAM.textMuted }}>{profile.tenure.dates}</span>
            </span>
          )}
          {profile.stage === 'alumni' && profile.alumniDates && (
            <span style={{ fontSize: 12, color: SKAM.textMuted }}>
              {profile.alumniDates}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {profile.stage === 'wrapping_up' ? (
          <React.Fragment>
            <Button variant="secondary">Send message</Button>
            <Button variant="primary">Generate exit summary</Button>
          </React.Fragment>
        ) : profile.stage === 'alumni' ? (
          <React.Fragment>
            <Button variant="secondary">View exit summary</Button>
            <Button variant="ghost">Archive</Button>
          </React.Fragment>
        ) : profile.stage === 'incoming' ? (
          <React.Fragment>
            <Button variant="secondary">Send welcome</Button>
            <Button variant="primary">Open onboarding</Button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <Button variant="secondary">Send message</Button>
            <Button variant="ghost">Edit profile</Button>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SKILL_LEVELS, SkillDots, LifecyclePill, ProfileHeader });
