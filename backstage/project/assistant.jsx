// AI assistant (§6.8) — ask-and-answer panel. Role-aware, answers always
// show sources from the knowledge base. The design caution from the brief
// drives the visual: sourced answers look solid, unsourced answers look
// visibly less certain.

function AIAssistant({ data }) {
  const isEmpty = data.messages.length === 0;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: SKAM.bg,
      }}
    >
      <AssistantHeader />

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isEmpty ? '0' : '24px 0 24px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isEmpty ? (
          <AssistantEmpty />
        ) : (
          <div
            style={{
              maxWidth: 880,
              width: '100%',
              margin: '0 auto',
              padding: '0 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            {data.messages.map((m, i) =>
              m.role === 'user' ? (
                <UserTurn key={i} message={m} viewer={data.viewer} />
              ) : (
                <AssistantTurn key={i} message={m} />
              )
            )}
          </div>
        )}
      </div>

      <Composer suggestions={isEmpty ? [] : null} />
    </div>
  );
}

// ---------- Header ------------------------------------------------------
function AssistantHeader() {
  return (
    <div
      style={{
        padding: '20px 32px 16px 32px',
        borderBottom: `0.5px solid ${SKAM.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: SKAM.text,
        }}
      >
        {/* a small, calm sparkle — not the genAI-cliché 4-point */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M4 12l2-2"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 17, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.005em' }}>
          Ask the assistant
        </h1>
        <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 2 }}>
          Answers from your knowledge base, scoped to what you can see. Always check sources before relying on them.
        </div>
      </div>
      <Button variant="ghost">New chat</Button>
    </div>
  );
}

// ---------- Turns -------------------------------------------------------
function UserTurn({ message, viewer }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
          maxWidth: '78%',
        }}
      >
        <PersonChip name={viewer} self />
        <div
          style={{
            background: SKAM.inset,
            border: `0.5px solid ${SKAM.border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            color: SKAM.text,
            lineHeight: 1.55,
          }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({ message }) {
  const kind = message.kind || 'sourced'; // 'sourced' | 'unsourced' | 'gap'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', maxWidth: '88%' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: SKAM.textMuted,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: SKAM.inset,
            border: `0.5px solid ${SKAM.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: SKAM.text2,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M4 12l2-2"/>
          </svg>
        </span>
        Assistant
        <ConfidenceBadge kind={kind} />
      </div>

      {kind === 'gap' ? (
        <GapAnswer message={message} />
      ) : (
        <React.Fragment>
          <div
            style={{
              background: kind === 'unsourced' ? SKAM.warningTint : SKAM.card,
              border: `0.5px solid ${kind === 'unsourced' ? 'rgba(197,128,14,0.30)' : SKAM.border}`,
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 14,
              color: SKAM.text,
              lineHeight: 1.65,
              fontStyle: kind === 'unsourced' ? 'italic' : 'normal',
            }}
          >
            {kind === 'unsourced' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: `0.5px solid rgba(197,128,14,0.20)`,
                  fontSize: 12,
                  color: SKAM.warning,
                  fontStyle: 'normal',
                  fontWeight: 500,
                }}
              >
                <span style={{ display: 'inline-flex' }}>{Icon.warn}</span>
                No verified source — verify this before relying on it.
              </div>
            )}
            <RichText text={message.text} />
          </div>

          {kind === 'sourced' && message.sources && message.sources.length > 0 && (
            <Sources sources={message.sources} />
          )}
        </React.Fragment>
      )}
    </div>
  );
}

function ConfidenceBadge({ kind }) {
  if (kind === 'sourced') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          color: SKAM.success,
          fontWeight: 500,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.success }} />
        sourced
      </span>
    );
  }
  if (kind === 'unsourced') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          color: SKAM.warning,
          fontWeight: 500,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.warning }} />
        no source
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        color: SKAM.red,
        fontWeight: 500,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.red }} />
      logged as a gap
    </span>
  );
}

function RichText({ text }) {
  // Render text with citation markers like [1], [2] highlighted.
  const parts = text.split(/(\[\d+\])/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (/^\[\d+\]$/.test(p)) {
          return (
            <sup
              key={i}
              style={{
                fontSize: 9,
                color: SKAM.info,
                background: SKAM.infoTint,
                padding: '1px 4px',
                borderRadius: 4,
                margin: '0 1px',
                fontWeight: 500,
              }}
            >
              {p.slice(1, -1)}
            </sup>
          );
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </span>
  );
}

Object.assign(window, { AIAssistant, UserTurn, AssistantTurn, ConfidenceBadge });
