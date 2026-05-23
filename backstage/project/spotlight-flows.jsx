// Spotlight — Lead nominate flow, Admin confirm view, History under Crew.

// ---------- Lead nominate flow ------------------------------------------
// A focused page. Lead picks one or more people, the period, writes a short
// reason, sends to admin for confirmation.
function NominatePage({ draft }) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '32px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>Spotlight</span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
          Nominate someone
        </h1>
        <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 540, lineHeight: 1.55 }}>
          Two-step on purpose. You nominate, an admin confirms. Keep the
          reason short — a sentence or two — and write it like you're telling
          the company in person.
        </div>
      </div>

      <Card>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Who" sublabel="Up to three people for a co-spotlight">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {draft.people.map((p, i) => (
                <SelectedChip key={i} name={p} />
              ))}
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: SKAM.inset,
                  border: `0.5px dashed ${SKAM.border}`,
                  color: SKAM.text2,
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {Icon.plus} Add person
              </button>
            </div>
          </Field>

          <Field label="Period" sublabel="Usually a month. Pick the one this celebrates.">
            <div
              style={{
                display: 'inline-flex',
                gap: 6,
                background: SKAM.inset,
                border: `0.5px solid ${SKAM.border}`,
                borderRadius: 8,
                padding: 3,
              }}
            >
              {['May 2026', 'Jun 2026', 'Jul 2026'].map((p) => (
                <button
                  key={p}
                  style={{
                    border: 0,
                    background: p === draft.period ? SKAM.card : 'transparent',
                    color: p === draft.period ? SKAM.text : SKAM.text2,
                    fontSize: 12,
                    fontWeight: p === draft.period ? 500 : 400,
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: p === draft.period ? `0 0 0 0.5px ${SKAM.border}` : 'none',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Reason"
            sublabel="A sentence or two. What did they do? Why does it matter?"
            charCount={draft.reason.length}
          >
            <div
              style={{
                background: SKAM.inset,
                border: `0.5px solid ${SKAM.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 14,
                color: SKAM.text,
                lineHeight: 1.55,
                minHeight: 96,
                whiteSpace: 'pre-wrap',
              }}
            >
              {draft.reason}
            </div>
          </Field>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: `0.5px solid ${SKAM.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: SKAM.textMuted, flex: 1 }}>
            Goes to {draft.confirmer} for confirmation before the company sees it.
          </span>
          <Button variant="ghost">Save draft</Button>
          <Button variant="primary">Send for confirmation</Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, sublabel, children, charCount }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: SKAM.text, fontWeight: 500 }}>{label}</span>
        {typeof charCount === 'number' && (
          <span style={{ fontSize: 11, color: SKAM.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {charCount} / 280
          </span>
        )}
      </div>
      {sublabel && <span style={{ fontSize: 11, color: SKAM.textMuted, lineHeight: 1.4 }}>{sublabel}</span>}
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function SelectedChip({ name }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: SKAM.card,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 999,
        padding: '4px 8px 4px 4px',
      }}
    >
      <PersonChip name={name} />
      <span style={{ color: SKAM.textMuted, fontSize: 14, cursor: 'pointer', display: 'inline-flex', padding: 2 }}>
        {Icon.close}
      </span>
    </span>
  );
}

// ---------- Admin confirm view ------------------------------------------
function AdminConfirmPage({ data }) {
  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
            Spotlight
          </h1>
          <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
            Pending nominations. Confirm to publish to the company.
          </div>
        </div>
        <Button variant="secondary">View history</Button>
      </div>

      {/* Current */}
      <div>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 8, paddingLeft: 4 }}>
          Currently spotlighted
        </div>
        <SpotlightForOthers spotlight={data.current} />
      </div>

      {/* Pending */}
      <div>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 8, paddingLeft: 4 }}>
          Pending · {data.pending.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.pending.map((n, i) => (
            <PendingRow key={i} nomination={n} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PendingRow({ nomination }) {
  return (
    <Card>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {nomination.people.map((p, i) => (
              <PersonChip key={i} name={p} size="md" />
            ))}
            <span style={{ fontSize: 11, color: SKAM.textMuted }}>· for {nomination.period}</span>
          </div>
          <div style={{ fontSize: 13, color: SKAM.text, lineHeight: 1.55, maxWidth: 560 }}>
            “{nomination.reason}”
          </div>
          <div style={{ fontSize: 11, color: SKAM.textMuted }}>
            Nominated by {nomination.nominatedBy} · {nomination.submitted}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Button variant="primary" icon={Icon.check}>Confirm</Button>
          <Button variant="ghost">Decline</Button>
        </div>
      </div>
    </Card>
  );
}

// ---------- History (under Crew) ----------------------------------------
function HistoryPage({ history }) {
  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
            Spotlight history
          </h1>
          <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
            Everyone the company has recognized, in order.
          </div>
        </div>
        <Button variant="secondary">Nominate someone</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {history.map((h, i) => (
          <HistoryRow key={i} item={h} first={i === 0} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ item, first }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 24,
        padding: '20px 0',
        borderTop: first ? 'none' : `0.5px solid ${SKAM.divider}`,
      }}
    >
      <div style={{ fontSize: 12, color: SKAM.text, fontWeight: 500, paddingTop: 2 }}>
        {item.period}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {item.people.map((p, i) => (
            <PersonChip key={i} name={p} size="md" />
          ))}
        </div>
        <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.55, maxWidth: 640 }}>
          {item.reason}
        </div>
        <div style={{ fontSize: 11, color: SKAM.textMuted }}>
          Nominated by {item.nominatedBy} · confirmed by {item.confirmedBy}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NominatePage, AdminConfirmPage, HistoryPage });
