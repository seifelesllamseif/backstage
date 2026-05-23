// Redeployment + Forecast sections + empty state.

// ---------- Redeployment -------------------------------------------------
function RedeploymentSection({ moves }) {
  if (!moves || moves.length === 0) {
    return (
      <Card>
        <SectionHeader title="Redeployment" meta="no suggestions right now" />
        <EmptyState
          message="No one is sitting in surplus while another role needs help. Things are balanced."
          dense
        />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeader
        title="Redeployment"
        meta={`${moves.length} suggested move${moves.length === 1 ? '' : 's'}`}
      />
      <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {moves.map((m, i) => (
          <RedeploymentRow key={i} move={m} />
        ))}
      </div>
    </Card>
  );
}

function RedeploymentRow({ move }) {
  return (
    <div
      style={{
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* surplus side */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '0 0 200px' }}>
        <span style={{ fontSize: 10, color: SKAM.textMuted }}>From surplus</span>
        <PersonChip name={move.person} />
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>{move.fromRole}</span>
      </div>

      {/* arrow */}
      <div style={{ flex: '0 0 auto', color: SKAM.textMuted, display: 'inline-flex' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"/>
        </svg>
      </div>

      {/* target role + reason */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: SKAM.textMuted }}>Into</span>
          <span style={{ fontSize: 13, color: SKAM.text, fontWeight: 500 }}>{move.toRole}</span>
          <CapacityLight state={move.toRoleState} />
        </div>
        <div style={{ fontSize: 12, color: SKAM.text2, lineHeight: 1.4 }}>
          {move.reasonKind === 'skill' && (
            <span>
              Secondary skill match — <span style={{ color: SKAM.text }}>{move.reason}</span>
            </span>
          )}
          {move.reasonKind === 'learning' && (
            <span>
              Stated learning goal — <span style={{ color: SKAM.text }}>{move.reason}</span>
            </span>
          )}
        </div>
      </div>

      <Button variant="secondary">Plan move</Button>
    </div>
  );
}

// ---------- Forecast -----------------------------------------------------
function ForecastSection({ forecast }) {
  const { months, rows, cliff } = forecast;
  return (
    <Card>
      <SectionHeader
        title="Forecast"
        meta="projected headcount · end dates known"
      >
        {cliff && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: SKAM.warning,
              background: 'rgba(239,159,39,0.10)',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 500,
              marginLeft: 8,
            }}
          >
            <span style={{ display: 'inline-flex' }}>{Icon.warn}</span>
            Cliff in {cliff.month}: {cliff.detail}
          </span>
        )}
      </SectionHeader>
      <div style={{ padding: '0 20px 20px 20px', overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `200px repeat(${months.length}, 1fr)`,
            borderTop: `0.5px solid ${SKAM.divider}`,
            borderLeft: `0.5px solid ${SKAM.divider}`,
          }}
        >
          {/* header row */}
          <ForecastHeaderCell label="Role" />
          {months.map((m, i) => (
            <ForecastHeaderCell key={i} label={m.label} sub={m.sub} center />
          ))}

          {/* rows */}
          {rows.map((r, ri) => (
            <React.Fragment key={ri}>
              <div
                style={{
                  padding: '10px 14px',
                  fontSize: 12,
                  color: SKAM.text,
                  borderRight: `0.5px solid ${SKAM.divider}`,
                  borderBottom: `0.5px solid ${SKAM.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.role}</span>
              </div>
              {r.cells.map((c, ci) => (
                <ForecastCell key={ci} cell={c} months={months} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ForecastHeaderCell({ label, sub, center }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        fontSize: 11,
        color: SKAM.textMuted,
        borderRight: `0.5px solid ${SKAM.divider}`,
        borderBottom: `0.5px solid ${SKAM.divider}`,
        textAlign: center ? 'center' : 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: center ? 'center' : 'flex-start',
      }}
    >
      <span style={{ color: SKAM.text2, fontWeight: 500 }}>{label}</span>
      {sub && <span style={{ fontSize: 10, color: SKAM.textDim }}>{sub}</span>}
    </div>
  );
}

const CELL_TINTS = {
  critical: 'rgba(226,75,74,0.18)',
  under:    'rgba(239,159,39,0.16)',
  staffed:  'rgba(93,202,165,0.12)',
  surplus:  'rgba(133,183,235,0.14)',
};

function ForecastCell({ cell }) {
  const tint = CELL_TINTS[cell.state] || 'transparent';
  const color = CAPACITY[cell.state];
  return (
    <div
      style={{
        padding: '10px 12px',
        background: tint,
        borderRight: `0.5px solid ${SKAM.divider}`,
        borderBottom: `0.5px solid ${SKAM.divider}`,
        textAlign: 'center',
        position: 'relative',
        minHeight: 38,
      }}
      title={cell.note || ''}
    >
      <div
        style={{
          fontSize: 13,
          color: SKAM.text,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {cell.count}
      </div>
      <div
        style={{
          fontSize: 10,
          color: color,
          marginTop: 1,
        }}
      >
        target {cell.range[0]}–{cell.range[1]}
      </div>
      {cell.cliff && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: SKAM.red,
            display: 'inline-flex',
          }}
        >
          {Icon.warn}
        </span>
      )}
    </div>
  );
}

// ---------- Empty state -------------------------------------------------
function CrewBoardEmpty() {
  return (
    <Card>
      <div style={{ padding: '60px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: SKAM.inset, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKAM.text2 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6.5" r="2.2"/><path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5"/>
            <circle cx="11.5" cy="5.5" r="1.6"/><path d="M14 11.5c0-1.6-1.2-2.5-2.5-2.5"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, color: SKAM.text, fontWeight: 500 }}>
          No roles defined yet
        </div>
        <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 380, lineHeight: 1.5 }}>
          Define the roles your company hires for. The Crew Board lights up
          once it knows what to compare your people against.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Button variant="primary" icon={Icon.plus}>Define roles</Button>
          <Button variant="secondary">Import from a template</Button>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { RedeploymentSection, ForecastSection, CrewBoardEmpty });
