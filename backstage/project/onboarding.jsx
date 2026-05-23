// Onboarding tracker (admin/mentor view) — §6.5.
// Layout: header + 4 metric cards, then a list of onboarders. Selecting one
// opens a right-side detail panel (step checklist + agreements gate + pack).

function OnboardingTrackerPage({ data, openId }) {
  const { summary, people } = data;
  const open = openId ? people.find((p) => p.id === openId) : null;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '24px 32px 60px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
                Onboarding tracker
              </h1>
              <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
                Every newcomer has a mentor and a guided start.
              </div>
            </div>
            <Button variant="primary" icon={Icon.plus}>Add newcomer</Button>
          </div>

          {/* Summary */}
          {people.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <MetricCard
                label="Onboarding now"
                value={summary.onboarding}
                sub={`${summary.onboarding > 0 ? 'across ' + summary.roleCount + ' roles' : ''}`}
              />
              <MetricCard
                label="Without a mentor"
                value={summary.unmentored}
                sub={summary.unmentored > 0 ? 'flagged · should be 0' : 'clean'}
              />
              <MetricCard
                label="Agreements unsigned"
                value={summary.unsigned}
                sub={summary.unsigned > 0 ? 'blocks full start' : 'all signed'}
              />
              <MetricCard
                label="Finish this month"
                value={summary.finishing}
                sub="end of onboarding window"
              />
            </div>
          )}

          {/* List */}
          {people.length === 0 ? (
            <Card>
              <div style={{ padding: '60px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: SKAM.inset, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKAM.text2 }}>
                  {Icon.inbox}
                </div>
                <div style={{ fontSize: 15, color: SKAM.text, fontWeight: 500 }}>Nobody is onboarding right now</div>
                <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 380, lineHeight: 1.5 }}>
                  When a newcomer is added, they appear here with their mentor,
                  progress, and any agreements still to sign.
                </div>
                <Button variant="primary" icon={Icon.plus}>Add newcomer</Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 140px 1fr 200px 28px',
                  gap: 16,
                  padding: '12px 20px',
                  borderBottom: `0.5px solid ${SKAM.divider}`,
                  fontSize: 11,
                  color: SKAM.textMuted,
                }}
              >
                <span>Person</span>
                <span>Start date</span>
                <span>Progress</span>
                <span>Mentor</span>
                <span />
              </div>
              {people.map((p, i) => (
                <OnboardingRow
                  key={p.id}
                  person={p}
                  selected={open && open.id === p.id}
                  last={i === people.length - 1}
                />
              ))}
            </Card>
          )}
        </div>
      </div>

      {open && <OnboardingDetailPanel person={open} />}
    </div>
  );
}

function OnboardingRow({ person, selected, last }) {
  const done = person.steps.filter((s) => s.state === 'done').length;
  const total = person.steps.length;
  const pct = total === 0 ? 0 : (done / total) * 100;
  const unsigned = (person.agreements || []).some((a) => !a.signed);
  const noMentor = !person.mentor;
  const finished = pct >= 100 && !unsigned;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 140px 1fr 200px 28px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 20px',
        borderTop: `0.5px solid ${SKAM.divider}`,
        background: selected ? SKAM.inset : 'transparent',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <PersonChip name={person.name} />
        <span style={{ fontSize: 11, color: SKAM.textMuted, paddingLeft: 28 }}>{person.role}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, color: SKAM.text }}>{person.startDate}</span>
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>{person.tenureLabel}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: SKAM.text2, fontVariantNumeric: 'tabular-nums' }}>
            {done}/{total} steps
          </span>
          {unsigned && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                color: SKAM.warning,
                background: SKAM.warningTint,
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'inline-flex' }}>{Icon.lock}</span>
              Agreements unsigned
            </span>
          )}
          {finished && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                color: SKAM.success,
                background: SKAM.successTint,
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'inline-flex' }}>{Icon.check}</span>
              Ready to start
            </span>
          )}
        </div>
        <ProgressBar
          segments={[{ value: pct, color: noMentor ? SKAM.warning : SKAM.red, title: 'done' }]}
          height={4}
        />
      </div>
      <div>
        {noMentor ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: SKAM.red,
              background: SKAM.redTint,
              padding: '4px 10px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'inline-flex' }}>{Icon.warn}</span>
            No mentor assigned
          </span>
        ) : (
          <PersonChip name={person.mentor} />
        )}
      </div>
      <button
        style={{
          background: 'transparent',
          border: 0,
          color: SKAM.text2,
          cursor: 'pointer',
          padding: 4,
          borderRadius: 6,
          display: 'inline-flex',
        }}
        title="Open"
      >
        {Icon.arrow}
      </button>
    </div>
  );
}

Object.assign(window, { OnboardingTrackerPage });
