// Vault — Post detail with comment thread.
// The post sits at the top in full; the comment thread sits below; reply
// composer is pinned at the bottom of the column.

function VaultPostDetail({ post, comments, viewer }) {
  return (
    <div
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '24px 32px 100px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: SKAM.textMuted }}>
        <a href="#" style={{ color: SKAM.text2, textDecoration: 'none' }}>← Vault</a>
        <span>·</span>
        <span style={{ display: 'inline-flex' }}><KindTag kind={post.kind} /></span>
      </div>

      {/* full post */}
      <VaultPost post={post} />

      {/* comment section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: SKAM.text, margin: 0 }}>
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </h2>
          <div
            style={{
              display: 'inline-flex',
              gap: 2,
              background: SKAM.inset,
              border: `0.5px solid ${SKAM.border}`,
              borderRadius: 8,
              padding: 2,
            }}
          >
            <SortButton label="Most voted" active />
            <SortButton label="Newest" />
          </div>
        </div>

        <Card style={{ padding: 0 }}>
          {comments.map((c, i) => (
            <CommentRow key={i} comment={c} last={i === comments.length - 1} />
          ))}
        </Card>
      </div>

      {/* reply composer */}
      <ReplyComposer viewer={viewer} />
    </div>
  );
}

function SortButton({ label, active }) {
  return (
    <button
      style={{
        border: 0,
        background: active ? SKAM.card : 'transparent',
        color: active ? SKAM.text : SKAM.text2,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: active ? 500 : 400,
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: active ? `0 0 0 0.5px ${SKAM.border}` : 'none',
      }}
    >
      {label}
    </button>
  );
}

function CommentRow({ comment, last, depth = 0 }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 18px 14px ' + (18 + depth * 28) + 'px',
          borderBottom: last && (!comment.replies || comment.replies.length === 0) ? 'none' : `0.5px solid ${SKAM.divider}`,
          position: 'relative',
        }}
      >
        {depth > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 18 + (depth - 1) * 28 + 12,
              top: 14,
              bottom: 14,
              width: 1,
              background: SKAM.divider,
            }}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PersonChip name={comment.author} />
            <span style={{ fontSize: 11, color: SKAM.textMuted }}>·</span>
            <span style={{ fontSize: 11, color: SKAM.textMuted }}>{comment.posted}</span>
            {comment.role && (
              <span
                style={{
                  fontSize: 10,
                  color: SKAM.text2,
                  background: SKAM.inset,
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {comment.role}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: SKAM.text, lineHeight: 1.55 }}>{comment.body}</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 2 }}>
            <CommentAction
              icon={<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11.5V2.5M3.5 6L7 2.5L10.5 6"/></svg>}
              label={`${comment.votes || 0}`}
              active={comment.voted}
            />
            <CommentAction label="Reply" />
            {comment.author === 'Sara Lindqvist' && <CommentAction label="Edit" />}
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.map((r, i) => (
        <CommentRow
          key={i}
          comment={r}
          last={last && i === comment.replies.length - 1}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function CommentAction({ icon, label, active }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: 0,
        color: active ? SKAM.red : SKAM.text2,
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {label}
    </button>
  );
}

function ReplyComposer({ viewer }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 24,
        background: SKAM.card,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: `0 4px 24px ${SKAM.mutedTint}`,
      }}
    >
      <PersonChip name={viewer} self />
      <div
        style={{
          flex: 1,
          fontSize: 13,
          color: SKAM.textMuted,
          padding: '6px 0',
        }}
      >
        Add a comment…
      </div>
      <Button variant="primary">Reply</Button>
    </div>
  );
}

Object.assign(window, { VaultPostDetail });
