// Spotlight (§6.9) — the Cockpit-embedded recognition block.
// Three states: someone is spotlit (viewer is NOT them), viewer IS spotlit
// (warm treatment), no current spotlight (calm empty line).

function SpotlightBlock({ spotlight, viewerName }) {
  if (!spotlight) {
    return <SpotlightEmpty />;
  }
  const viewerIsSpotlit = spotlight.people.some((p) => p === viewerName);
  return viewerIsSpotlit ? (
    <SpotlightForYou spotlight={spotlight} />
  ) : (
    <SpotlightForOthers spotlight={spotlight} />
  );
}

// ---------- Default: viewer is not the spotlit person ------------------
function SpotlightForOthers({ spotlight }) {
  return (
    <Card>
      <div
        style={{
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: '120px 1fr auto',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <SpotlightBadge />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: SKAM.textMuted, letterSpacing: '0.02em' }}>
              Spotlight · {spotlight.period}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {spotlight.people.map((p, i) => (
              <PersonChip key={i} name={p} size="md" />
            ))}
          </div>
          <div style={{ fontSize: 13, color: SKAM.text, lineHeight: 1.55, marginTop: 2, maxWidth: 600 }}>
            {spotlight.reason}
          </div>
          <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 2 }}>
            Nominated by {spotlight.nominatedBy} · confirmed by {spotlight.confirmedBy}
          </div>
        </div>

        <Button variant="ghost">View history</Button>
      </div>
    </Card>
  );
}

// ---------- You-treatment ------------------------------------------------
// Warm SKAM-red treatment. §3.5 explicitly allows red on a recognition
// moment. Used here as a soft tint + a clear "you are spotlit" lead-in.
function SpotlightForYou({ spotlight }) {
  const others = spotlight.people.length > 1;
  return (
    <Card style={{ background: SKAM.redTint, borderColor: 'rgba(214,62,61,0.30)', overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          padding: '22px 26px',
          display: 'grid',
          gridTemplateColumns: '120px 1fr auto',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <SpotlightBadge warm />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11,
              color: SKAM.red,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'none',
            }}
          >
            Spotlight · {spotlight.period}
          </span>
          <div style={{ fontSize: 22, color: SKAM.text, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {others ? 'You and the team are spotlit this month.' : 'You are spotlit this month.'}
          </div>
          {others && (
            <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              {spotlight.people.map((p, i) => (
                <PersonChip key={i} name={p} size="md" self={false} />
              ))}
            </div>
          )}
          <div style={{ fontSize: 13, color: SKAM.text, lineHeight: 1.6, marginTop: 4, maxWidth: 600 }}>
            {spotlight.reason}
          </div>
          <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 6 }}>
            From {spotlight.nominatedBy} (nominated) and {spotlight.confirmedBy} (confirmed).
          </div>
        </div>
        <Button variant="secondary">Read the note</Button>
      </div>
    </Card>
  );
}

// ---------- Empty: no current spotlight ---------------------------------
function SpotlightEmpty() {
  return (
    <Card>
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <SpotlightBadge muted />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, color: SKAM.textMuted }}>Spotlight</span>
          <span style={{ fontSize: 14, color: SKAM.text }}>
            No one spotlighted right now.
          </span>
          <span style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 2 }}>
            Leads can nominate someone whose work deserves a wider audience.
          </span>
        </div>
        <Button variant="secondary">Nominate someone</Button>
      </div>
    </Card>
  );
}

// ---------- Spotlight badge ---------------------------------------------
// A small recognizable glyph used in both states. Keeps the block readable
// without inventing a new pattern — it's effectively a "logo" for the
// feature, not a generic icon.
function SpotlightBadge({ warm = false, muted = false }) {
  const ring = warm ? SKAM.red : muted ? SKAM.textMuted : SKAM.text;
  return (
    <div
      style={{
        width: 90,
        height: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
        {/* concentric thin rings — a stage spotlight, beamed from above */}
        <circle cx="45" cy="45" r="36" stroke={ring} strokeOpacity="0.20" strokeWidth="0.5" />
        <circle cx="45" cy="45" r="28" stroke={ring} strokeOpacity="0.35" strokeWidth="0.5" />
        <circle cx="45" cy="45" r="20" stroke={ring} strokeOpacity="0.55" strokeWidth="0.5" />
        <circle cx="45" cy="45" r="12" stroke={ring} strokeOpacity="0.85" strokeWidth="0.6" />
        <circle cx="45" cy="45" r="6"  fill={ring} fillOpacity={muted ? 0.4 : 1} />
        {/* beams */}
        <path d="M45 4 L36 30 L54 30 Z" fill={ring} fillOpacity={warm ? 0.5 : muted ? 0.10 : 0.18} />
      </svg>
    </div>
  );
}

Object.assign(window, { SpotlightBlock, SpotlightBadge, SpotlightForOthers, SpotlightForYou, SpotlightEmpty });
