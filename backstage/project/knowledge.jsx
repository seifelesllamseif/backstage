// Knowledge base — §6.6.
// Searchable list of docs with verification states, owner, scope; a
// management view for stale/unowned docs; and a Knowledge gaps tab listing
// AI-unanswered questions.

const DOC_STATUS = {
  verified:   { label: 'Verified',           color: 'success',   tint: 'successTint' },
  draft:      { label: 'Draft',              color: 'textMuted', tint: 'mutedTint'   },
  expired:    { label: 'Verification expired', color: 'red',     tint: 'redTint'     },
  outdated:   { label: 'Outdated',           color: 'warning',   tint: 'warningTint' },
  empty:      { label: 'Empty',              color: 'textDim',   tint: 'mutedTint'   },
};

function DocStatusPill({ status }) {
  const s = DOC_STATUS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: SKAM[s.tint],
        color: SKAM[s.color],
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM[s.color] }} />
      {s.label}
    </span>
  );
}

// ---------- Page assembly ------------------------------------------------
function KnowledgeBase({ data, view = 'all' }) {
  const isGaps = view === 'gaps';
  const isAttention = view === 'attention';
  const isEmpty = data.docs.length === 0 && view !== 'gaps';

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '24px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <KnowledgeHeader summary={data.summary} hideMetrics={isEmpty} />

      {/* View tabs */}
      <Tabs
        value={view}
        items={[
          { value: 'all',       label: 'All docs',          count: data.summary.total },
          { value: 'mine',      label: 'Mine',              count: data.summary.mine },
          { value: 'attention', label: 'Needs attention',   count: data.summary.attention, tone: data.summary.attention > 0 ? 'warning' : null },
          { value: 'gaps',      label: 'Knowledge gaps',    count: data.summary.gaps,      tone: 'red' },
        ]}
      />

      {/* Body */}
      {isEmpty ? (
        <KnowledgeBaseEmpty />
      ) : isGaps ? (
        <KnowledgeGaps gaps={data.gaps} />
      ) : (
        <DocList
          docs={
            isAttention
              ? data.docs.filter((d) => ['expired','outdated','empty'].includes(d.status) || !d.owner)
              : view === 'mine'
              ? data.docs.filter((d) => d.owner === data.summary.me)
              : data.docs
          }
        />
      )}
    </div>
  );
}

function KnowledgeHeader({ summary, hideMetrics }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
            Knowledge base
          </h1>
          <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
            One source of truth for SOPs, role guides, and policies. Also what the assistant reads.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary">Import</Button>
          <Button variant="primary" icon={Icon.plus}>New doc</Button>
        </div>
      </div>

      {!hideMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard label="Total docs"          value={summary.total}    sub={summary.totalSub} />
          <MetricCard label="Verified"            value={summary.verified} sub={`${summary.verifiedPct}% of base`} />
          <MetricCard label="Needs attention"     value={summary.attention} sub="stale, expired, or unowned" />
          <MetricCard label="Knowledge gaps"      value={summary.gaps}     sub="questions the AI couldn't answer" />
        </div>
      )}
    </div>
  );
}

// ---------- Tabs (consistent across pages where used) -------------------
function Tabs({ value, items, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: 3,
        alignSelf: 'flex-start',
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        const toneColor =
          it.tone === 'warning' ? SKAM.warning :
          it.tone === 'red'     ? SKAM.red     : SKAM.textMuted;
        return (
          <button
            key={it.value}
            onClick={() => onChange && onChange(it.value)}
            style={{
              border: 0,
              background: active ? SKAM.card : 'transparent',
              color: active ? SKAM.text : SKAM.text2,
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              padding: '7px 14px',
              borderRadius: 7,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: active ? `0 0 0 0.5px ${SKAM.border}` : 'none',
            }}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span style={{ fontSize: 10, color: toneColor, fontVariantNumeric: 'tabular-nums' }}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { KnowledgeBase, DOC_STATUS, DocStatusPill, Tabs });
