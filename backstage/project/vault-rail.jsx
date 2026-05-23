// Vault — right rail (Vault contributors), tips card, empty state.

function ContributorRail({ contributors }) {
  return (
    <Card>
      <SectionHeader title="Top contributors" meta="this month · Vault activity" />
      <div style={{ padding: '0 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {contributors.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
            }}
          >
            <span style={{ fontSize: 11, color: SKAM.textMuted, width: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {i + 1}
            </span>
            <PersonChip name={c.name} />
            <span style={{ flex: 1 }} />
            <div
              style={{
                display: 'flex',
                gap: 4,
              }}
              title={`${c.posts} posts`}
            >
              <span style={{ fontSize: 11, color: SKAM.text2, fontVariantNumeric: 'tabular-nums' }}>
                {c.posts}
              </span>
              <span style={{ fontSize: 11, color: SKAM.textMuted }}>posts</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 20px', borderTop: `0.5px solid ${SKAM.divider}`, fontSize: 11, color: SKAM.textMuted, lineHeight: 1.4 }}>
        Activity tally, not recognition. The company Spotlight lives on your Cockpit.
      </div>
    </Card>
  );
}

function TipsCard() {
  return (
    <Card>
      <SectionHeader title="What to share" />
      <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TipLine kind="idea"        body="A half-formed thought you can't shake — others can finish it." />
        <TipLine kind="quote"       body="A line that captures what you're working on, by you or someone else." />
        <TipLine kind="inspiration" body="A still, a frame, a reference. The why behind a choice." />
        <TipLine kind="source"      body="A link worth keeping. A few words on what it gave you." />
        <TipLine kind="project"     body="Something you shipped that you're proud of." />
      </div>
    </Card>
  );
}

function TipLine({ kind, body }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <KindTag kind={kind} />
      <span style={{ fontSize: 12, color: SKAM.text2, lineHeight: 1.5, flex: 1 }}>{body}</span>
    </div>
  );
}

// ---------- Empty Vault -------------------------------------------------
function VaultEmpty() {
  return (
    <Card>
      <div
        style={{
          padding: '48px 32px 40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: SKAM.inset,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: SKAM.text2,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3.5" width="12" height="11" rx="2"/><circle cx="9" cy="9" r="2.4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, color: SKAM.text, fontWeight: 500, marginBottom: 6 }}>
            The Vault is empty. Share the first thing.
          </div>
          <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 460, lineHeight: 1.5 }}>
            This is the shared culture space. Pin an idea, a quote, a frame,
            a link, or something you shipped. Five kinds; you decide.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            width: '100%',
            maxWidth: 720,
          }}
        >
          {Object.keys(POST_KIND).map((k) => (
            <KindStarterCard key={k} kind={k} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function KindStarterCard({ kind }) {
  const k = POST_KIND[kind];
  return (
    <button
      style={{
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: '14px 10px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
        textAlign: 'left',
      }}
    >
      <KindTag kind={kind} />
      <span style={{ fontSize: 12, color: SKAM.text }}>Share an {k.label === 'Idea' ? 'idea' : k.label.toLowerCase()}</span>
    </button>
  );
}

Object.assign(window, { ContributorRail, TipsCard, VaultEmpty });
