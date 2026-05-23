// Task detail panel — right-side slide-over for the board.
// Hosts the handoff doc with the six fixed fields from §6.2.
// In the "gate" variant, attempting Done on an unfilled handoff renders an
// inline gate explaining what's missing.

const HANDOFF_FIELDS = [
  { key: 'what',     label: 'What it is' },
  { key: 'current',  label: 'Current status' },
  { key: 'done',     label: 'What is done so far' },
  { key: 'left',     label: "What's still left" },
  { key: 'files',    label: 'Where the files live' },
  { key: 'gotchas',  label: 'Gotchas' },
  { key: 'asks',     label: 'Who to ask' },
];

function TaskPanel({ task, mode = 'ready', onClose }) {
  // mode: 'ready' (handoff filled, can move to Done)
  //       'gate'  (user clicked Done but handoff is incomplete)
  const isGate = mode === 'gate';
  const handoff = task.handoff || {};
  const missing = HANDOFF_FIELDS.filter((f) => f.key !== 'asks').filter(
    (f) => !handoff[f.key] || !handoff[f.key].trim()
  );

  return (
    <aside
      style={{
        width: 480,
        flex: '0 0 480px',
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
          padding: '14px 20px',
          borderBottom: `0.5px solid ${SKAM.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: SKAM.textDim,
            fontVariantNumeric: 'tabular-nums',
            background: SKAM.inset,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {task.id}
        </span>
        <StatusPill status={task.status} />
        <span style={{ flex: 1 }} />
        <button
          onClick={onClose}
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

      {/* scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px 24px 20px' }}>
        <h2
          style={{
            fontSize: 18,
            color: SKAM.text,
            fontWeight: 500,
            margin: '0 0 8px 0',
            lineHeight: 1.3,
            letterSpacing: '-0.005em',
          }}
        >
          {task.title}
        </h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 18,
            alignItems: 'center',
          }}
        >
          <DetailField label="Assignee">
            {task.assignee ? <PersonChip name={task.assignee} /> : <Dim>Unassigned</Dim>}
          </DetailField>
          <DetailField label="Due">
            <span style={{ fontSize: 12, color: task.overdue ? SKAM.red : SKAM.text }}>{task.due || 'No date'}</span>
          </DetailField>
          {task.disciplines && task.disciplines.length > 0 && (
            <DetailField label="Discipline">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {task.disciplines.map((d, i) => <DisciplineChip key={i} label={d} />)}
              </div>
            </DetailField>
          )}
        </div>

        {/* Gate */}
        {isGate && (
          <div
            style={{
              background: 'rgba(226,75,74,0.06)',
              border: `0.5px solid rgba(226,75,74,0.35)`,
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 18,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: SKAM.red, marginTop: 1, display: 'inline-flex' }}>{Icon.lock}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: SKAM.text, fontWeight: 500, marginBottom: 4 }}>
                Fill the handoff to mark this done
              </div>
              <div style={{ fontSize: 12, color: SKAM.text2, lineHeight: 1.5, marginBottom: 10 }}>
                A task can only move to Done after its handoff doc is complete,
                so whoever picks it up next has what they need.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {missing.map((f) => (
                  <span
                    key={f.key}
                    style={{
                      fontSize: 11,
                      color: SKAM.red,
                      background: 'rgba(226,75,74,0.08)',
                      border: `0.5px solid rgba(226,75,74,0.28)`,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {f.label}
                  </span>
                ))}
              </div>
              <Button variant="primary">Fill the handoff</Button>
            </div>
          </div>
        )}

        {/* Handoff doc */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h3 style={{ fontSize: 13, color: SKAM.text, fontWeight: 500, margin: 0 }}>
            Handoff
          </h3>
          <HandoffStatus complete={!isGate} missingCount={missing.length} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {HANDOFF_FIELDS.map((f) => (
            <HandoffField
              key={f.key}
              label={f.label}
              value={handoff[f.key]}
              isPerson={f.key === 'asks'}
              missing={isGate && missing.some((m) => m.key === f.key)}
            />
          ))}
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: `0.5px solid ${SKAM.divider}`,
          display: 'flex',
          gap: 8,
        }}
      >
        <Button variant="secondary">Open on board</Button>
        <span style={{ flex: 1 }} />
        {isGate ? (
          <Button variant="ghost">Move to Done</Button>
        ) : (
          <Button variant="primary" icon={Icon.check}>Move to Done</Button>
        )}
      </div>
    </aside>
  );
}

function DetailField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: SKAM.textMuted, letterSpacing: '0.02em' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Dim({ children }) {
  return <span style={{ fontSize: 12, color: SKAM.textDim }}>{children}</span>;
}

function HandoffStatus({ complete, missingCount }) {
  if (complete) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: SKAM.success,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.success }} />
        Complete
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: SKAM.warning,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.warning }} />
      {missingCount} field{missingCount === 1 ? '' : 's'} missing
    </span>
  );
}

function HandoffField({ label, value, isPerson, missing }) {
  return (
    <div
      style={{
        background: missing ? 'rgba(226,75,74,0.04)' : SKAM.inset,
        border: `0.5px solid ${missing ? 'rgba(226,75,74,0.30)' : SKAM.divider}`,
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: missing ? SKAM.red : SKAM.textMuted,
          marginBottom: 6,
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {label}
        {missing && <span>· empty</span>}
      </div>
      {value ? (
        isPerson && Array.isArray(value) ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {value.map((p, i) => (
              <PersonChip key={i} name={p} />
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: SKAM.text,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {value}
          </div>
        )
      ) : (
        <div style={{ fontSize: 12, color: SKAM.textDim, fontStyle: 'italic' }}>
          Not filled in yet
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TaskPanel, HANDOFF_FIELDS });
