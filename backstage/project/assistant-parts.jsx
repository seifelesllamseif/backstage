// AI assistant — Sources strip, Gap state, Composer, Empty state, fixtures.

// ---------- Sources strip ----------------------------------------------
function Sources({ sources }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: SKAM.textMuted, paddingLeft: 2 }}>
        Sources · {sources.length} from your knowledge base
      </span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {sources.map((s, i) => (
          <SourceCard key={i} number={i + 1} source={s} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ number, source }) {
  const statusColor =
    source.status === 'verified' ? SKAM.success :
    source.status === 'outdated' ? SKAM.warning :
    source.status === 'expired'  ? SKAM.red     : SKAM.textMuted;
  return (
    <a
      href="#"
      style={{
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 9,
          color: SKAM.info,
          background: SKAM.infoTint,
          padding: '1px 5px',
          borderRadius: 4,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {number}
        </span>
        <span style={{ fontSize: 11, color: SKAM.text2 }}>{source.kind}</span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: statusColor }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: statusColor }} />
          {source.status === 'verified' ? 'Verified' :
            source.status === 'outdated' ? 'Outdated' :
            source.status === 'expired'  ? 'Expired'  : 'Draft'}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: SKAM.text,
          fontWeight: 500,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {source.title}
      </div>
      <div style={{ fontSize: 11, color: SKAM.textMuted }}>
        Owner {source.owner} · {source.scope}
      </div>
    </a>
  );
}

// ---------- Gap answer -------------------------------------------------
function GapAnswer({ message }) {
  return (
    <div
      style={{
        background: SKAM.card,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 12,
        padding: '18px 20px',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 14, color: SKAM.text, lineHeight: 1.6, marginBottom: 12 }}>
        I can't answer this from the knowledge base — there's nothing there
        on it yet, and I won't guess.
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.divider}`,
          borderRadius: 10,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: SKAM.redTint,
            color: SKAM.red,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon.plus}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: SKAM.text, fontWeight: 500 }}>
            Logged as a knowledge gap
          </div>
          <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 2 }}>
            “{message.question}” · {message.askedCount}× asked across the company
          </div>
        </div>
        <Button variant="secondary">Open gap list</Button>
      </div>
    </div>
  );
}

// ---------- Composer ----------------------------------------------------
function Composer({ suggestions }) {
  return (
    <div
      style={{
        borderTop: `0.5px solid ${SKAM.divider}`,
        background: SKAM.bg,
        padding: '14px 32px 18px 32px',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions && suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestions.map((s, i) => (
              <Suggestion key={i} text={s} />
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: SKAM.card,
            border: `0.5px solid ${SKAM.border}`,
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 14,
              color: SKAM.textMuted,
              fontFamily: 'inherit',
              minHeight: 22,
              lineHeight: 1.5,
            }}
          >
            Ask anything you can find in the knowledge base…
          </span>
          <Button variant="primary">Ask</Button>
        </div>
        <div style={{ fontSize: 10, color: SKAM.textDim, textAlign: 'center' }}>
          The assistant only sees what you have access to.
        </div>
      </div>
    </div>
  );
}

function Suggestion({ text }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        color: SKAM.text2,
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {text}
    </button>
  );
}

// ---------- Empty -------------------------------------------------------
function AssistantEmpty() {
  const suggestions = [
    'What are our shot log conventions?',
    'How do handoffs work?',
    'Where do I put the final render of an Aurora episode?',
    'Who owns the press kit deliverables?',
    'What\'s the LUT for Aurora ep. 3 daylight exteriors?',
  ];
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        gap: 24,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: SKAM.text,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M4 12l2-2"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 18, color: SKAM.text, fontWeight: 500, letterSpacing: '-0.005em', marginBottom: 6 }}>
          Ask the knowledge base
        </div>
        <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.6 }}>
          The assistant only knows what your team has written down. Answers
          come with sources you can click through to verify.
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, color: SKAM.textMuted, textAlign: 'center' }}>Try one of these</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              style={{
                background: SKAM.inset,
                border: `0.5px solid ${SKAM.border}`,
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 13,
                color: SKAM.text,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>{Icon.search}</span>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sources, GapAnswer, Composer, AssistantEmpty });
