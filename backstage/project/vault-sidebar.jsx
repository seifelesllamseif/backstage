// Vault — Contributor rail + Tips + Empty state + fixtures.

// ---------- Contributor rail --------------------------------------------
// Vault-only activity. Explicitly NOT the company Spotlight (§6.9) — this is
// "who posts in the Vault a lot this month".
function ContributorRail({ contributors }) {
  return (
    <Card>
      <SectionHeader title="Top contributors" meta="this month · Vault activity" />
      <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {contributors.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 8px',
              borderRadius: 8,
              background: i === 0 ? SKAM.inset : 'transparent',
            }}
          >
            <span
              style={{
                width: 20,
                color: SKAM.textMuted,
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
              }}
            >
              {i + 1}
            </span>
            <PersonChip name={c.name} />
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: SKAM.text2 }}>
              <span style={{ color: SKAM.text, fontWeight: 500 }}>{c.posts}</span>
              <span style={{ color: SKAM.textMuted }}> posts</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Note that explains the boundary with Spotlight. Sets reader expectations.
function TipsCard() {
  return (
    <Card>
      <SectionHeader title="House rules" />
      <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: SKAM.text2, lineHeight: 1.55 }}>
        <div>· Anything that sparks a piece of work can live here.</div>
        <div>· No work tasks, no status updates — that's the board.</div>
        <div>· Cite the source when you can. Future-you will thank you.</div>
        <div style={{ paddingTop: 8, borderTop: `0.5px solid ${SKAM.divider}`, marginTop: 4, color: SKAM.textMuted }}>
          Looking for the company recognition? That's the Spotlight, on your Cockpit.
        </div>
      </div>
    </Card>
  );
}

// ---------- Empty state -------------------------------------------------
function VaultEmpty() {
  const kinds = [
    { kind: 'idea',        body: 'A spark, a half-baked notion, something worth chewing on.' },
    { kind: 'quote',       body: 'A line that captures something you can\'t quite say.' },
    { kind: 'inspiration', body: 'An image, a film, a song that opened a door.' },
    { kind: 'source',      body: 'A link worth saving — a paper, an article, a tool.' },
    { kind: 'project',     body: 'Something outside SKAM you want the team to see.' },
  ];
  return (
    <Card>
      <div
        style={{
          padding: '40px 32px 40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, color: SKAM.text, fontWeight: 500, letterSpacing: '-0.005em' }}>
          Share the first thing
        </div>
        <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 460, lineHeight: 1.55 }}>
          The Vault is the company's culture space — ideas, quotes, images
          and sources that fuel the work. Pick a kind to start.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            width: '100%',
            maxWidth: 760,
            marginTop: 4,
          }}
        >
          {kinds.map((k) => (
            <KindPicker key={k.kind} kind={k.kind} body={k.body} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function KindPicker({ kind, body }) {
  const k = POST_KIND[kind];
  return (
    <button
      style={{
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <KindTag kind={kind} />
      <div style={{ fontSize: 11, color: SKAM.text2, lineHeight: 1.5 }}>{body}</div>
    </button>
  );
}

Object.assign(window, { ContributorRail, TipsCard, VaultEmpty });
