// Vault — §6.7. Shared culture space: feed of posts (idea, quote,
// inspiration, source, project) + a right rail with top Vault contributors.

const POST_KIND = {
  idea:        { label: 'Idea',        color: 'info'    },
  quote:       { label: 'Quote',       color: 'success' },
  inspiration: { label: 'Inspiration', color: 'warning' },
  source:      { label: 'Source',      color: 'text2'   },
  project:     { label: 'Project',     color: 'red'     },
};

function VaultPage({ data, view = 'all' }) {
  const isEmpty = data.posts.length === 0;
  const filter = view === 'all' ? null : view;
  const posts = filter ? data.posts.filter((p) => p.kind === filter) : data.posts;

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '24px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <VaultHeader counts={data.counts} hideMetrics={isEmpty} />

      {isEmpty ? (
        <VaultEmpty />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <KindFilters active={view} counts={data.counts} />
            {posts.length === 0 ? (
              <Card>
                <EmptyState message="No posts in this kind yet." dense />
              </Card>
            ) : (
              posts.map((p) => <VaultPost key={p.id} post={p} />)
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ContributorRail contributors={data.contributors} />
            <TipsCard />
          </div>
        </div>
      )}
    </div>
  );
}

function VaultHeader({ counts, hideMetrics }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
          Vault
        </h1>
        <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>
          Ideas, quotes, inspiration, and the sparks behind the work.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!hideMetrics && (
          <span style={{ fontSize: 12, color: SKAM.textMuted, marginRight: 4 }}>
            {counts.total} posts · {counts.contributors} contributors
          </span>
        )}
        <Button variant="primary" icon={Icon.plus}>Share something</Button>
      </div>
    </div>
  );
}

function KindFilters({ active, counts }) {
  const items = [
    { value: 'all',         label: 'All',         count: counts.total },
    { value: 'idea',        label: 'Idea',        count: counts.idea },
    { value: 'quote',       label: 'Quote',       count: counts.quote },
    { value: 'inspiration', label: 'Inspiration', count: counts.inspiration },
    { value: 'source',      label: 'Source',      count: counts.source },
    { value: 'project',     label: 'Project',     count: counts.project },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const a = it.value === active;
        const colorKey = it.value === 'all' ? 'text2' : POST_KIND[it.value].color;
        return (
          <button
            key={it.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: a ? SKAM.card : 'transparent',
              border: `0.5px solid ${a ? SKAM.border : SKAM.divider}`,
              color: a ? SKAM.text : SKAM.text2,
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: a ? 500 : 400,
            }}
          >
            {it.value !== 'all' && (
              <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM[colorKey] }} />
            )}
            {it.label}
            <span style={{ fontSize: 10, color: SKAM.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {it.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Post --------------------------------------------------------
function VaultPost({ post }) {
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PersonChip name={post.author} />
          <KindTag kind={post.kind} />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: SKAM.textMuted, fontVariantNumeric: 'tabular-nums' }}>{post.posted}</span>
        </div>

        {/* Body — varies by kind */}
        <PostBody post={post} />

        {/* Actions */}
        <PostActions post={post} />
      </div>
    </Card>
  );
}

function KindTag({ kind }) {
  const k = POST_KIND[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: SKAM[k.color],
        background: SKAM[(k.color === 'red' ? 'redTint' : k.color === 'success' ? 'successTint' : k.color === 'warning' ? 'warningTint' : k.color === 'info' ? 'infoTint' : 'mutedTint')],
        padding: '3px 9px',
        borderRadius: 999,
        fontWeight: 500,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM[k.color] }} />
      {k.label}
    </span>
  );
}

function PostBody({ post }) {
  switch (post.kind) {
    case 'idea':
      return (
        <div>
          <div style={{ fontSize: 16, color: SKAM.text, fontWeight: 500, lineHeight: 1.3, marginBottom: 6, letterSpacing: '-0.005em' }}>
            {post.title}
          </div>
          <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.55 }}>{post.body}</div>
        </div>
      );
    case 'quote':
      return (
        <div
          style={{
            position: 'relative',
            paddingLeft: 14,
            borderLeft: `2px solid ${SKAM.text}`,
          }}
        >
          <div
            style={{
              fontSize: 17,
              color: SKAM.text,
              lineHeight: 1.4,
              fontWeight: 400,
              letterSpacing: '-0.005em',
            }}
          >
            “{post.body}”
          </div>
          <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 8 }}>
            — {post.attribution}
          </div>
        </div>
      );
    case 'inspiration':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ImageTile palette={post.palette} aspect={post.aspect || '4/3'} />
          <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.55 }}>{post.body}</div>
          {post.url && (
            <a href={post.url} style={{ fontSize: 11, color: SKAM.textMuted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {Icon.link} {post.urlLabel || post.url}
            </a>
          )}
        </div>
      );
    case 'source':
      return (
        <a
          href={post.url}
          style={{
            textDecoration: 'none',
            display: 'flex',
            background: SKAM.inset,
            border: `0.5px solid ${SKAM.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>{Icon.link}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: SKAM.text, fontWeight: 500, lineHeight: 1.3, marginBottom: 3 }}>
              {post.title}
            </div>
            <div style={{ fontSize: 11, color: SKAM.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post.urlLabel || post.url}
            </div>
            {post.body && (
              <div style={{ fontSize: 12, color: SKAM.text2, marginTop: 8, lineHeight: 1.5 }}>{post.body}</div>
            )}
          </div>
        </a>
      );
    case 'project':
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ProjectTag name={post.project} />
            <span style={{ fontSize: 11, color: SKAM.textMuted }}>{post.role}</span>
          </div>
          <div style={{ fontSize: 16, color: SKAM.text, fontWeight: 500, lineHeight: 1.3, marginBottom: 6, letterSpacing: '-0.005em' }}>
            {post.title}
          </div>
          <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.55 }}>{post.body}</div>
        </div>
      );
    default:
      return null;
  }
}

// Inspiration tile — flat color block stand-in. The shape and palette change
// per post so the feed reads as varied without inventing image assets.
function ImageTile({ palette = ['#C9A6E0','#7B8FA1','#1A1816'], aspect = '4/3' }) {
  return (
    <div
      style={{
        aspectRatio: aspect,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
      }}
    >
      {palette.map((c, i) => (
        <div key={i} style={{ background: c }} />
      ))}
    </div>
  );
}

function PostActions({ post }) {
  const empty = (post.votes || 0) === 0 && (post.comments || 0) === 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingTop: 4,
        borderTop: `0.5px solid ${SKAM.divider}`,
        marginTop: 2,
      }}
    >
      <ActionButton
        icon={
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 11.5V2.5M3.5 6L7 2.5L10.5 6"/>
          </svg>
        }
        label={post.voted ? `Upvoted · ${post.votes}` : `Upvote · ${post.votes || 0}`}
        active={post.voted}
      />
      <ActionButton
        icon={
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h10v6H5.5L2.5 11V3z"/>
          </svg>
        }
        label={`Reply · ${post.comments || 0}`}
      />
      <span style={{ flex: 1 }} />
      {empty && (
        <span style={{ fontSize: 11, color: SKAM.textMuted, fontStyle: 'italic' }}>
          Be the first to react
        </span>
      )}
    </div>
  );
}

function ActionButton({ icon, label, active }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: 0,
        color: active ? SKAM.red : SKAM.text2,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '6px 4px',
      }}
    >
      <span style={{ display: 'inline-flex' }}>{icon}</span>
      {label}
    </button>
  );
}

Object.assign(window, { VaultPage, POST_KIND, VaultPost, KindTag, ImageTile });
