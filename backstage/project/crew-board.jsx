// Crew Board — admin view of capacity.
// Layout: page header (month + summary metrics) → capacity by role (grouped
// by family) → redeployment suggestions → forecast grid.

function CrewBoard({ data, viewMonth }) {
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '20px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <CrewBoardHeader month={viewMonth} summary={data.summary} />

      {data.families.length === 0 ? (
        <CrewBoardEmpty />
      ) : (
        <React.Fragment>
          <CapacitySection families={data.families} />
          <RedeploymentSection moves={data.redeployment} />
          <ForecastSection forecast={data.forecast} />
        </React.Fragment>
      )}
    </div>
  );
}

// ---------- Header --------------------------------------------------------
function CrewBoardHeader({ month, summary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              color: SKAM.text,
              letterSpacing: '-0.01em',
            }}
          >
            Crew Board
          </h1>
          <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
            Who you have, who you need, who could move.
          </div>
        </div>
        <MonthSelector value={month} />
      </div>

      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          <MetricCard label="Total crew" value={summary.total} sub={summary.totalSub} />
          <MetricCard label="Roles staffed" value={summary.staffed} sub={summary.staffedSub} />
          <MetricCard label="Roles needing hire" value={summary.needsHire} sub={summary.needsHireSub} />
          <MetricCard label="Roles in surplus" value={summary.surplus} sub={summary.surplusSub} />
        </div>
      )}
    </div>
  );
}

function MonthSelector({ value }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        style={{
          background: 'transparent',
          border: 0,
          color: SKAM.text2,
          padding: '6px 10px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        title="Previous"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 3L4 6l3.5 3"/></svg>
      </button>
      <span
        style={{
          fontSize: 12,
          color: SKAM.text,
          padding: '6px 10px',
          fontWeight: 500,
          borderLeft: `0.5px solid ${SKAM.border}`,
          borderRight: `0.5px solid ${SKAM.border}`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <button
        style={{
          background: 'transparent',
          border: 0,
          color: SKAM.text2,
          padding: '6px 10px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        title="Next"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3L8 6l-3.5 3"/></svg>
      </button>
    </div>
  );
}

Object.assign(window, { CrewBoard });
