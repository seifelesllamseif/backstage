// Project timeline — milestones and tasks across time.
// Visibility marker on each milestone: project (everyone), leads (leads only),
// restricted (only listed viewers). In restricted-viewer mode, hidden items
// collapse into a single "Restricted" placeholder row per slot so the viewer
// knows something exists, but not what — same shape, no detail.

function ProjectTimeline({ project, timeline, viewer = 'full' }) {
  // viewer: 'full'  → leads-eye view, sees everything
  //         'restricted' → non-permitted viewer, hidden items become placeholders

  const weeks = timeline.weeks;
  const todayCol = timeline.todayCol;
  const swimlanes = timeline.swimlanes; // [{label, items: [...]}]

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: '20px 32px 32px 32px',
        gap: 18,
      }}
    >
      {/* viewer banner */}
      {viewer === 'restricted' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: SKAM.inset,
            border: `0.5px solid ${SKAM.border}`,
            borderRadius: 10,
            color: SKAM.text2,
            fontSize: 12,
          }}
        >
          <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>{Icon.lock}</span>
          <span style={{ color: SKAM.text }}>You see a reduced view of this timeline.</span>
          <span>Some milestones are restricted to leads or a named list.</span>
        </div>
      )}

      <Card style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* week header */}
        <TimelineHeader weeks={weeks} todayCol={todayCol} />

        {/* swimlanes */}
        <div>
          {swimlanes.map((lane, i) => (
            <SwimLane
              key={i}
              lane={lane}
              weeks={weeks}
              todayCol={todayCol}
              viewer={viewer}
              last={i === swimlanes.length - 1}
            />
          ))}
        </div>
      </Card>

      {/* legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 11,
          color: SKAM.textMuted,
          padding: '0 4px',
          flexWrap: 'wrap',
        }}
      >
        <span>Visibility</span>
        <Legend dot={SKAM.text2} label="Project" />
        <Legend dot={SKAM.warning} label="Leads only" />
        <Legend dot={SKAM.red} label="Restricted" />
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 1, height: 10, background: SKAM.red, opacity: 0.6 }} />
          Today
        </span>
      </div>
    </div>
  );
}

function Legend({ dot, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
      {label}
    </span>
  );
}

const LANE_LABEL_W = 168;

function TimelineHeader({ weeks, todayCol }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LANE_LABEL_W}px repeat(${weeks.length}, 1fr)`,
        borderBottom: `0.5px solid ${SKAM.divider}`,
        background: SKAM.card,
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <div style={{ padding: '10px 16px', fontSize: 11, color: SKAM.textMuted }}>
        Lane
      </div>
      {weeks.map((w, i) => (
        <div
          key={i}
          style={{
            padding: '10px 10px',
            fontSize: 11,
            color: SKAM.textMuted,
            borderLeft: `0.5px solid ${SKAM.divider}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <span style={{ color: SKAM.text2 }}>{w.label}</span>
          {w.dates && <span style={{ color: SKAM.textDim, fontSize: 10 }}>{w.dates}</span>}
        </div>
      ))}
    </div>
  );
}

function SwimLane({ lane, weeks, todayCol, viewer, last }) {
  // Filter items by viewer visibility, replacing restricted ones with a
  // placeholder span if a non-permitted viewer is looking.
  const items = lane.items.map((it) => {
    if (viewer === 'restricted' && it.visibility !== 'project') {
      return { ...it, _placeholder: true };
    }
    return it;
  });

  // Pack into rows so overlapping items don't collide.
  const rows = packRows(items);
  const rowH = 30;
  const padding = 10;
  const laneHeight = rows.length * rowH + padding * 2 + (rows.length === 0 ? 18 : 0);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${LANE_LABEL_W}px 1fr`,
        borderBottom: last ? 'none' : `0.5px solid ${SKAM.divider}`,
        minHeight: laneHeight,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          fontSize: 12,
          color: SKAM.text,
          borderRight: `0.5px solid ${SKAM.divider}`,
          background: SKAM.card,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <span>{lane.label}</span>
        {lane.sub && <span style={{ fontSize: 10, color: SKAM.textMuted }}>{lane.sub}</span>}
      </div>
      <div
        style={{
          position: 'relative',
          padding: `${padding}px 0`,
          minHeight: laneHeight,
          background:
            // subtle weekend-ish striping via column tints. Cheap depth without shadows.
            `repeating-linear-gradient(to right, transparent 0, transparent calc(100%/${weeks.length} - 0.5px), ${SKAM.divider} calc(100%/${weeks.length} - 0.5px), ${SKAM.divider} calc(100%/${weeks.length}))`,
        }}
      >
        {/* today line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${(todayCol / weeks.length) * 100}%)`,
            width: 1,
            background: SKAM.red,
            opacity: 0.55,
          }}
        />

        {rows.map((row, ri) =>
          row.map((it, ii) => (
            <TimelineItem
              key={`${ri}-${ii}`}
              item={it}
              weeks={weeks}
              top={padding + ri * rowH}
            />
          ))
        )}

        {rows.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: SKAM.textDim,
            }}
          >
            Nothing scheduled
          </div>
        )}
      </div>
    </div>
  );
}

function packRows(items) {
  // Simple greedy row packing: a new row when no existing row can fit.
  const rows = [];
  const sorted = [...items].sort((a, b) => a.startCol - b.startCol);
  for (const it of sorted) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (last.endCol < it.startCol) {
        row.push(it);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([it]);
  }
  return rows;
}

function TimelineItem({ item, weeks, top }) {
  if (item._placeholder) {
    return <RestrictedPlaceholder item={item} weeks={weeks} top={top} />;
  }
  const isMilestone = item.kind === 'milestone';
  const colorMap = {
    on_track: SKAM.info,
    at_risk:  SKAM.warning,
    done:     SKAM.success,
  };
  const color = colorMap[item.status] || SKAM.info;
  const visDot =
    item.visibility === 'leads'
      ? SKAM.warning
      : item.visibility === 'restricted'
      ? SKAM.red
      : null;

  const leftPct = (item.startCol / weeks.length) * 100;
  const widthPct = ((item.endCol - item.startCol + 1) / weeks.length) * 100;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        height: 22,
        background: isMilestone ? color : 'transparent',
        border: isMilestone ? 'none' : `0.5px solid ${color}`,
        borderRadius: 6,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: isMilestone ? SKAM.bg : color,
        fontWeight: 500,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      title={item.title}
    >
      {visDot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: visDot,
            flex: '0 0 auto',
            boxShadow: isMilestone ? `0 0 0 1.5px ${color}` : 'none',
          }}
        />
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
        }}
      >
        {item.title}
      </span>
      {isMilestone && (
        <span
          style={{
            width: 8,
            height: 8,
            transform: 'rotate(45deg)',
            background: SKAM.bg,
            opacity: 0.4,
            flex: '0 0 auto',
            marginRight: -2,
          }}
        />
      )}
    </div>
  );
}

function RestrictedPlaceholder({ item, weeks, top }) {
  const leftPct = (item.startCol / weeks.length) * 100;
  const widthPct = ((item.endCol - item.startCol + 1) / weeks.length) * 100;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        height: 22,
        background:
          'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 6px, transparent 6px 12px)',
        border: `0.5px dashed ${SKAM.border}`,
        borderRadius: 6,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: SKAM.textDim,
        fontStyle: 'italic',
      }}
      title="Restricted — you do not have access"
    >
      <span style={{ display: 'inline-flex', color: SKAM.textDim }}>{Icon.lock}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Restricted{item.visibility === 'leads' ? ' · leads only' : ''}
      </span>
    </div>
  );
}

Object.assign(window, { ProjectTimeline });
