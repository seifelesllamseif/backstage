// Vault — Compose flow + Post detail with comments.

// ---------- Compose flow ------------------------------------------------
// A focused page (no chrome competition). Kind already picked at top; the
// fields below adapt to that kind so the form is shaped like the post.
function VaultCompose({ draft }) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '32px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, color: SKAM.textMuted }}>Vault · new post</span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: SKAM.text, letterSpacing: '-0.01em' }}>
          Share something
        </h1>
        <div style={{ fontSize: 13, color: SKAM.text2, maxWidth: 540, lineHeight: 1.55 }}>
          Pick a kind. The form shapes itself to match.
        </div>
      </div>

      {/* Kind switcher — segmented control */}
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          background: SKAM.inset,
          border: `0.5px solid ${SKAM.border}`,
          borderRadius: 10,
          padding: 3,
          alignSelf: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {['idea','quote','inspiration','source','project'].map((k) => {
          const active = k === draft.kind;
          return (
            <button
              key={k}
              style={{
                border: 0,
                background: active ? SKAM.card : 'transparent',
                color: active ? SKAM.text : SKAM.text2,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                borderRadius: 7,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? `0 0 0 0.5px ${SKAM.border}` : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM[POST_KIND[k].color] }} />
              {POST_KIND[k].label}
            </button>
          );
        })}
      </div>

      {/* Form, shaped by kind */}
      <Card>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ComposeFields draft={draft} />
        </div>
        <div
          style={{
            padding: '12px 20px',
            borderTop: `0.5px solid ${SKAM.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: SKAM.textMuted, flex: 1 }}>
            Posts are visible to everyone in the company.
          </span>
          <Button variant="ghost">Save draft</Button>
          <Button variant="secondary">Preview</Button>
          <Button variant="primary">Post to Vault</Button>
        </div>
      </Card>

      {/* Live preview */}
      <div>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 8, paddingLeft: 4 }}>
          Preview
        </div>
        <VaultPost post={previewFromDraft(draft)} />
      </div>
    </div>
  );
}

function ComposeFields({ draft }) {
  const Title = ({ children }) => (
    <input
      readOnly
      value={children || ''}
      placeholder={children ? undefined : 'Give it a clear title'}
      style={{
        width: '100%',
        background: 'transparent',
        border: 0,
        outline: 'none',
        fontSize: 22,
        fontWeight: 500,
        color: SKAM.text,
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        padding: 0,
      }}
    />
  );
  const Body = ({ children, placeholder, big }) => (
    <textarea
      readOnly
      value={children || ''}
      placeholder={children ? undefined : placeholder}
      rows={big ? 5 : 3}
      style={{
        width: '100%',
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 10,
        outline: 'none',
        padding: '12px 14px',
        fontSize: 14,
        color: SKAM.text,
        fontFamily: 'inherit',
        lineHeight: 1.6,
        resize: 'none',
      }}
    />
  );

  switch (draft.kind) {
    case 'idea':
      return (
        <React.Fragment>
          <FieldLabel label="Title" />
          <Title>{draft.title}</Title>
          <FieldLabel label="Body" sub="The spark, in plain language. Why does it matter?" />
          <Body big>{draft.body}</Body>
        </React.Fragment>
      );
    case 'quote':
      return (
        <React.Fragment>
          <FieldLabel label="The quote" />
          <Body big placeholder="“…”">{draft.body}</Body>
          <FieldLabel label="Attribution" sub="Who said it. Source if you have one." />
          <Body>{draft.attribution}</Body>
        </React.Fragment>
      );
    case 'inspiration':
      return (
        <React.Fragment>
          <FieldLabel label="Image" sub="Drop in an image, or paste a URL. A placeholder is fine." />
          <ImageDrop palette={draft.palette} aspect={draft.aspect || '4/3'} />
          <FieldLabel label="Why this caught you" />
          <Body big>{draft.body}</Body>
          <FieldLabel label="Where it came from" sub="Optional link or credit" />
          <Body>{draft.urlLabel}</Body>
        </React.Fragment>
      );
    case 'source':
      return (
        <React.Fragment>
          <FieldLabel label="Link" />
          <Body placeholder="https://…">{draft.urlLabel || draft.url}</Body>
          <FieldLabel label="What it is" />
          <Title>{draft.title}</Title>
          <FieldLabel label="Why share it" sub="A line or two. Future-you will thank you." />
          <Body>{draft.body}</Body>
        </React.Fragment>
      );
    case 'project':
      return (
        <React.Fragment>
          <FieldLabel label="Project / context" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ProjectTag name={draft.project || 'Side · Lighthouse'} />
            <span style={{ fontSize: 12, color: SKAM.textMuted }}>{draft.role}</span>
          </div>
          <FieldLabel label="Title" />
          <Title>{draft.title}</Title>
          <FieldLabel label="Body" sub="What you made. What you learned." />
          <Body big>{draft.body}</Body>
        </React.Fragment>
      );
    default:
      return null;
  }
}

function FieldLabel({ label, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, marginBottom: -8 }}>
      <span style={{ fontSize: 12, color: SKAM.text, fontWeight: 500 }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: SKAM.textMuted, lineHeight: 1.4 }}>{sub}</span>}
    </div>
  );
}

function ImageDrop({ palette, aspect }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 10,
        overflow: 'hidden',
        border: `0.5px dashed ${SKAM.border}`,
      }}
    >
      <ImageTile palette={palette} aspect={aspect} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: 10,
        }}
      >
        <Button variant="secondary">Replace</Button>
      </div>
    </div>
  );
}

// Take a draft and reshape it into a Post-like object for VaultPost render.
function previewFromDraft(draft) {
  return {
    id: 'preview',
    kind: draft.kind,
    author: draft.author,
    posted: 'just now',
    title: draft.title,
    body: draft.body,
    attribution: draft.attribution,
    palette: draft.palette,
    aspect: draft.aspect,
    url: draft.url,
    urlLabel: draft.urlLabel,
    project: draft.project,
    role: draft.role,
    votes: 0,
    comments: 0,
  };
}

Object.assign(window, { VaultCompose });
