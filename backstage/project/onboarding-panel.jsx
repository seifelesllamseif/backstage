// Onboarding tracker — detail panel.
// Step checklist + agreements gate (hard gate before Mark as started) +
// role onboarding pack (links into Knowledge base).

function OnboardingDetailPanel({ person }) {
  const stepsDone = person.steps.filter((s) => s.state === 'done').length;
  const stepsTotal = person.steps.length;
  const allStepsDone = stepsDone === stepsTotal;
  const unsigned = (person.agreements || []).filter((a) => !a.signed);
  const allSigned = unsigned.length === 0;
  const noMentor = !person.mentor;
  const canStart = allStepsDone && allSigned && !noMentor;

  return (
    <aside
      style={{
        width: 460,
        flex: '0 0 460px',
        background: SKAM.card,
        borderLeft: `0.5px solid ${SKAM.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* header */}
      <div
        style={{
          padding: '16px 20px 12px 20px',
          borderBottom: `0.5px solid ${SKAM.divider}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <PersonChip name={person.name} size="md" />
          <span style={{ flex: 1 }} />
          <button
            style={{
              background: 'transparent',
              border: 0,
              color: SKAM.textMuted,
              cursor: 'pointer',
              display: 'inline-flex',
              padding: 4,
              borderRadius: 4,
            }}
          >
            {Icon.close}
          </button>
        </div>
        <div style={{ fontSize: 12, color: SKAM.text2 }}>
          {person.role} · {person.contract} · starts {person.startDate}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Mentor */}
        <PanelSection title="Mentor">
          {noMentor ? (
            <div
              style={{
                background: SKAM.redTint,
                border: `0.5px solid rgba(214,62,61,0.30)`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ color: SKAM.red, display: 'inline-flex' }}>{Icon.warn}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: SKAM.text, fontWeight: 500 }}>
                  No mentor assigned
                </div>
                <div style={{ fontSize: 11, color: SKAM.text2, marginTop: 2 }}>
                  Every newcomer must have a mentor before day one.
                </div>
              </div>
              <Button variant="primary">Assign mentor</Button>
            </div>
          ) : (
            <div
              style={{
                background: SKAM.inset,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <PersonChip name={person.mentor} />
              <span style={{ flex: 1, fontSize: 11, color: SKAM.textMuted }}>{person.mentorRole}</span>
              <Button variant="ghost">Change</Button>
            </div>
          )}
        </PanelSection>

        {/* Steps */}
        <PanelSection title="Steps" meta={`${stepsDone} of ${stepsTotal} done`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {person.steps.map((s, i) => (
              <StepRow key={i} step={s} />
            ))}
          </div>
        </PanelSection>

        {/* Agreements */}
        <PanelSection
          title="Agreements to sign"
          meta={allSigned ? 'all signed' : `${unsigned.length} unsigned · gate`}
          metaTone={allSigned ? 'success' : 'warning'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {person.agreements.map((a, i) => (
              <AgreementRow key={i} agreement={a} />
            ))}
          </div>
        </PanelSection>

        {/* Role onboarding pack */}
        <PanelSection title="Role onboarding pack" meta={`${person.pack.length} docs`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {person.pack.map((d, i) => (
              <PackRow key={i} doc={d} />
            ))}
          </div>
        </PanelSection>
      </div>

      {/* footer — hard gate */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: `0.5px solid ${SKAM.divider}`,
          background: SKAM.card,
        }}
      >
        {!canStart && (
          <div
            style={{
              fontSize: 11,
              color: SKAM.textMuted,
              marginBottom: 8,
              lineHeight: 1.5,
            }}
          >
            {noMentor && <div>· Assign a mentor</div>}
            {!allSigned && <div>· {unsigned.length} agreement{unsigned.length === 1 ? '' : 's'} to sign</div>}
            {!allStepsDone && <div>· {stepsTotal - stepsDone} step{stepsTotal - stepsDone === 1 ? '' : 's'} still open</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary">Open profile</Button>
          <span style={{ flex: 1 }} />
          {canStart ? (
            <Button variant="primary" icon={Icon.check}>Mark as fully started</Button>
          ) : (
            <Button variant="ghost">Mark as fully started</Button>
          )}
        </div>
      </div>
    </aside>
  );
}

function PanelSection({ title, meta, metaTone, children }) {
  const tone =
    metaTone === 'success' ? SKAM.success :
    metaTone === 'warning' ? SKAM.warning :
    SKAM.textMuted;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, color: SKAM.text, fontWeight: 500, margin: 0 }}>{title}</h3>
        {meta && <span style={{ fontSize: 11, color: tone }}>{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function StepRow({ step }) {
  const isDone = step.state === 'done';
  const isProg = step.state === 'in_progress';
  let iconEl, color;
  if (isDone) {
    color = SKAM.success;
    iconEl = (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: SKAM.success,
          color: SKAM.bg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon.check}
      </span>
    );
  } else if (isProg) {
    color = SKAM.red;
    iconEl = (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: `1.5px solid ${SKAM.red}`,
          background: 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.red }} />
      </span>
    );
  } else {
    color = SKAM.textMuted;
    iconEl = (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: `1px solid ${SKAM.border}`,
          background: SKAM.inset,
          display: 'inline-block',
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: isProg ? SKAM.redTint : 'transparent',
      }}
    >
      {iconEl}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: isDone ? SKAM.text2 : SKAM.text,
          fontWeight: isProg ? 500 : 400,
          textDecoration: isDone ? 'line-through' : 'none',
          textDecorationColor: SKAM.textDim,
        }}
      >
        {step.label}
      </span>
      {step.due && (
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>{step.due}</span>
      )}
    </div>
  );
}

function AgreementRow({ agreement }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: agreement.signed ? SKAM.inset : SKAM.warningTint,
        border: agreement.signed ? `0.5px solid ${SKAM.divider}` : `0.5px solid rgba(197,128,14,0.35)`,
        borderRadius: 8,
      }}
    >
      <span
        style={{
          color: agreement.signed ? SKAM.success : SKAM.warning,
          display: 'inline-flex',
        }}
      >
        {agreement.signed ? Icon.check : Icon.lock}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: SKAM.text,
          fontWeight: agreement.signed ? 400 : 500,
        }}
      >
        {agreement.name}
      </span>
      {agreement.signed ? (
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>Signed {agreement.signedOn}</span>
      ) : (
        <Button variant="secondary">Send for signature</Button>
      )}
    </div>
  );
}

function PackRow({ doc }) {
  const verified = doc.verified;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.divider}`,
        borderRadius: 8,
      }}
    >
      <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 1.5h6L11 4v8.5H3V1.5z"/><path d="M9 1.5V4h2"/>
        </svg>
      </span>
      <span style={{ flex: 1, fontSize: 12, color: SKAM.text }}>{doc.title}</span>
      {verified ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: SKAM.success,
          }}
        >
          <span style={{ width: 4, height: 4, borderRadius: 999, background: SKAM.success }} />
          Verified
        </span>
      ) : (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: SKAM.warning,
          }}
        >
          <span style={{ width: 4, height: 4, borderRadius: 999, background: SKAM.warning }} />
          {doc.state || 'Draft'}
        </span>
      )}
    </div>
  );
}

Object.assign(window, { OnboardingDetailPanel });
