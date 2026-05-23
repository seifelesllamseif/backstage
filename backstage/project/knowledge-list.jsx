// Knowledge base — Doc list, Search + filters, Empty, Knowledge gaps.

// ---------- Doc list ----------------------------------------------------
function DocList({ docs }) {
  return (
    <Card>
      <SearchAndFilters />
      {docs.length === 0 ? (
        <EmptyState message="No docs match these filters." dense />
      ) : (
        <React.Fragment>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr 180px 180px 120px',
              gap: 16,
              padding: '10px 20px',
              borderTop: `0.5px solid ${SKAM.divider}`,
              borderBottom: `0.5px solid ${SKAM.divider}`,
              fontSize: 11,
              color: SKAM.textMuted,
            }}
          >
            <span>Status</span>
            <span>Title</span>
            <span>Scope</span>
            <span>Owner</span>
            <span style={{ textAlign: 'right' }}>Last verified</span>
          </div>
          {docs.map((d, i) => (
            <DocRow key={d.id} doc={d} last={i === docs.length - 1} />
          ))}
        </React.Fragment>
      )}
    </Card>
  );
}

function SearchAndFilters() {
  return (
    <div
      style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.border}`,
          borderRadius: 8,
          padding: '8px 12px',
        }}
      >
        <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>{Icon.search}</span>
        <span style={{ fontSize: 13, color: SKAM.textMuted }}>
          Search docs by title, body, or owner…
        </span>
      </div>
      <FilterChip2 label="Kind" value="All" />
      <FilterChip2 label="Scope" value="All" />
      <FilterChip2 label="Status" value="All" />
    </div>
  );
}

function FilterChip2({ label, value }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: SKAM.card,
        border: `0.5px solid ${SKAM.border}`,
        color: SKAM.text2,
        padding: '7px 12px',
        borderRadius: 8,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: SKAM.textMuted }}>{label}</span>
      <span style={{ color: SKAM.text }}>{value}</span>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: SKAM.textMuted }}>
        <path d="M3.5 5L6 7.5L8.5 5"/>
      </svg>
    </button>
  );
}

function DocRow({ doc, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr 180px 180px 120px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: last ? 'none' : `0.5px solid ${SKAM.divider}`,
      }}
    >
      <DocStatusPill status={doc.status} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: SKAM.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.title}
        </div>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 3 }}>
          {doc.kind}{doc.summary ? ' · ' + doc.summary : ''}
        </div>
      </div>
      <div>
        {doc.scope === 'Company' ? (
          <span
            style={{
              display: 'inline-flex',
              fontSize: 11,
              color: SKAM.text2,
              background: SKAM.inset,
              border: `0.5px solid ${SKAM.border}`,
              padding: '2px 7px',
              borderRadius: 4,
            }}
          >
            Company
          </span>
        ) : (
          <ProjectTag name={doc.scope} />
        )}
      </div>
      <div>
        {doc.owner ? (
          <PersonChip name={doc.owner} />
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: SKAM.red,
              background: SKAM.redTint,
              padding: '3px 9px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'inline-flex' }}>{Icon.warn}</span>
            No owner
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: SKAM.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {doc.lastVerified || '—'}
      </div>
    </div>
  );
}

// ---------- Knowledge gaps ----------------------------------------------
function KnowledgeGaps({ gaps }) {
  if (!gaps || gaps.length === 0) {
    return (
      <Card>
        <SectionHeader title="Knowledge gaps" meta="zero" />
        <EmptyState
          message="The assistant has been able to answer every question with sources. Beautiful."
          dense
        />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeader
        title="Knowledge gaps"
        meta={`${gaps.length} unanswered question${gaps.length === 1 ? '' : 's'}`}
      />
      <div style={{ padding: '0 0 8px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 160px 140px',
            gap: 16,
            padding: '8px 20px',
            borderTop: `0.5px solid ${SKAM.divider}`,
            borderBottom: `0.5px solid ${SKAM.divider}`,
            fontSize: 11,
            color: SKAM.textMuted,
          }}
        >
          <span>Question</span>
          <span>Asked by</span>
          <span>Frequency</span>
          <span style={{ textAlign: 'right' }} />
        </div>
        {gaps.map((g, i) => (
          <GapRow key={i} gap={g} last={i === gaps.length - 1} />
        ))}
      </div>
    </Card>
  );
}

function GapRow({ gap, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px 160px 140px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: last ? 'none' : `0.5px solid ${SKAM.divider}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: SKAM.text }}>"{gap.question}"</div>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 4 }}>
          Last asked {gap.lastAsked}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PersonChip name={gap.askers[0]} />
        {gap.askers.length > 1 && (
          <span style={{ fontSize: 11, color: SKAM.textMuted }}>+{gap.askers.length - 1}</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: SKAM.text2 }}>
        Asked <span style={{ color: SKAM.text, fontWeight: 500 }}>{gap.count}×</span> by {gap.askers.length} {gap.askers.length === 1 ? 'person' : 'people'}
      </div>
      <div style={{ textAlign: 'right' }}>
        <Button variant="primary" icon={Icon.plus}>Write doc</Button>
      </div>
    </div>
  );
}

// ---------- Empty state -------------------------------------------------
function KnowledgeBaseEmpty() {
  return (
    <Card>
      <div style={{ padding: '48px 32px 40px 32px', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: SKAM.inset, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKAM.text2 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h9.5a2.5 2.5 0 0 1 2.5 2.5V15H5a2 2 0 0 1-2-2V3z"/><path d="M3 13a2 2 0 0 1 2-2h10"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, color: SKAM.text, fontWeight: 500, marginBottom: 6 }}>
            Your knowledge base is empty
          </div>
          <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 460, lineHeight: 1.5 }}>
            Import the docs you already have, or write the first one from
            scratch. The assistant will start answering questions as soon as
            there's something to read.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            width: '100%',
            maxWidth: 600,
          }}
        >
          <ImportCard
            title="Import from Google Docs"
            body="Pick a Drive folder. Each doc lands with its owner and a draft status."
          />
          <ImportCard
            title="Import Markdown"
            body="Drop .md files. Titles and front-matter become metadata."
          />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: SKAM.textMuted }}>or</span>
          <Button variant="primary" icon={Icon.plus}>Write the first doc</Button>
        </div>
      </div>
    </Card>
  );
}

function ImportCard({ title, body }) {
  return (
    <div
      style={{
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        padding: '16px 18px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, color: SKAM.text, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 12, color: SKAM.text2, lineHeight: 1.5 }}>{body}</div>
      <Button variant="secondary">Start import</Button>
    </div>
  );
}

Object.assign(window, { DocList, KnowledgeGaps, KnowledgeBaseEmpty });
