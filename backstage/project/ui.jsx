// Shared UI primitives for Crew OS — exact components from design.md §5.
// Everything here is the single canonical implementation. Pages reuse these;
// they never redraw them.

// Two themes, same shape. Light mode is a re-skin per design.md §3.2.
// Picked at load via document.documentElement.dataset.theme. Pages built
// before the light switch don't set this attr and stay dark.
const SKAM_DARK = {
  bg: '#0E0E10',
  card: '#161618',
  inset: '#1A1A1C',
  border: '#2A2A2E',
  divider: '#232327',
  text: '#F2F2F0',
  text2: '#A8A8AE',
  textMuted: '#8A8A90',
  textDim: '#5C5C62',
  red: '#E24B4A',
  success: '#5DCAA5',
  warning: '#EF9F27',
  info: '#85B7EB',
  // tint helpers — translucent versions of the status colors used as
  // backgrounds. Light mode needs different values so they read on white.
  redTint:     'rgba(226,75,74,0.10)',
  redTintHi:   'rgba(226,75,74,0.18)',
  successTint: 'rgba(93,202,165,0.14)',
  warningTint: 'rgba(239,159,39,0.14)',
  infoTint:    'rgba(133,183,235,0.14)',
  mutedTint:   'rgba(168,168,174,0.10)',
  // surface tints used on hover/active rows
  hover:       'rgba(255,255,255,0.03)',
  // theme name
  mode: 'dark',
};

const SKAM_LIGHT = {
  // Warm, paper-feeling whites + near-blacks. Borders a little stronger
  // since 0.5px on white is otherwise invisible.
  bg: '#F7F6F2',
  card: '#FFFFFF',
  inset: '#F1EFE9',
  border: '#D9D6CE',
  divider: '#E8E5DD',
  text: '#1A1816',
  text2: '#5A5852',
  textMuted: '#86837C',
  textDim: '#B2AFA6',
  // Slightly more saturated reds/oranges so they sit clean on white.
  red: '#D63E3D',
  success: '#2E9C74',
  warning: '#C5800E',
  info: '#3D7DBE',
  redTint:     'rgba(214,62,61,0.10)',
  redTintHi:   'rgba(214,62,61,0.16)',
  successTint: 'rgba(46,156,116,0.12)',
  warningTint: 'rgba(197,128,14,0.13)',
  infoTint:    'rgba(61,125,190,0.12)',
  mutedTint:   'rgba(26,24,22,0.05)',
  hover:       'rgba(26,24,22,0.03)',
  mode: 'light',
};

const SKAM = (typeof document !== 'undefined' &&
              document.documentElement.dataset.theme === 'light')
  ? SKAM_LIGHT
  : SKAM_DARK;

// ---------- Card ----------------------------------------------------------
// Default container. card bg, 0.5px border, 12px radius.
function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: SKAM.card,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 12,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------- SectionHeader ------------------------------------------------
// 16px medium title, optional right-side meta.
function SectionHeader({ title, meta, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 20px 12px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: SKAM.text,
            margin: 0,
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </h2>
        {children}
      </div>
      {meta && (
        <div style={{ fontSize: 12, color: SKAM.textMuted, fontWeight: 400 }}>{meta}</div>
      )}
    </div>
  );
}

// ---------- PersonChip ---------------------------------------------------
// The only way a person is shown. Avatar = initials. `self` marks the
// viewer's own identity with a small SKAM-red dot — the one place red ever
// touches a person.
function PersonChip({ name, self = false, size = 'sm', muted = false }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const dims = size === 'lg' ? 36 : size === 'md' ? 24 : 20;
  const font = size === 'lg' ? 14 : size === 'md' ? 11 : 10;
  const textSize = size === 'lg' ? 15 : size === 'md' ? 13 : 13;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          width: dims,
          height: dims,
          borderRadius: 6,
          background: SKAM.inset,
          color: SKAM.text2,
          fontSize: font,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          letterSpacing: '0.02em',
        }}
      >
        {initials}
        {self && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: SKAM.red,
              boxShadow: `0 0 0 2px ${SKAM.card}`,
            }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: textSize,
          color: muted ? SKAM.text2 : SKAM.text,
          fontWeight: size === 'lg' ? 500 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ---------- StatusPill ---------------------------------------------------
// Fixed colors per status — see design.md §5.
const STATUS = {
  backlog:     { label: 'Backlog',     color: SKAM.textMuted, tint: 'rgba(168,168,174,0.10)' },
  unscoped:    { label: 'Unscoped',    color: SKAM.textMuted, tint: 'rgba(168,168,174,0.10)' },
  todo:        { label: 'To do',       color: SKAM.text2,     tint: 'rgba(168,168,174,0.12)' },
  in_progress: { label: 'In progress', color: SKAM.info,      tint: 'rgba(133,183,235,0.14)' },
  in_review:   { label: 'In review',   color: SKAM.warning,   tint: 'rgba(239,159,39,0.14)'  },
  done:        { label: 'Done',        color: SKAM.success,   tint: 'rgba(93,202,165,0.14)'  },
  canceled:    { label: 'Canceled',    color: SKAM.textDim,   tint: 'rgba(92,92,98,0.18)'    },
};
function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.todo;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: s.tint,
        color: s.color,
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        letterSpacing: '0.005em',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: s.color }} />
      {s.label}
    </span>
  );
}

// ---------- ProjectTag ---------------------------------------------------
// Small neutral tag for a project name.
function ProjectTag({ name, dim = false }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        color: dim ? SKAM.textMuted : SKAM.text2,
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        padding: '2px 7px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        fontWeight: 400,
      }}
    >
      {name}
    </span>
  );
}

// ---------- CapacityLight ------------------------------------------------
// Colored dot for role/allocation health.
const CAPACITY = {
  critical: SKAM.red,
  under:    SKAM.warning,
  staffed:  SKAM.success,
  surplus:  SKAM.info,
};
function CapacityLight({ state = 'staffed', label, size = 8 }) {
  const color = CAPACITY[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: color,
        }}
      />
      {label && <span style={{ fontSize: 12, color: SKAM.text2 }}>{label}</span>}
    </span>
  );
}

// ---------- MetricCard ---------------------------------------------------
// Muted label above, large number below, inset bg, no border.
function MetricCard({ label, value, sub }) {
  return (
    <div
      style={{
        background: SKAM.inset,
        borderRadius: 10,
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, color: SKAM.text, fontWeight: 500, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ---------- ProgressBar --------------------------------------------------
// Thin, one or more colored segments. Used for onboarding and allocation.
function ProgressBar({ segments, height = 6, track = SKAM.inset, radius = 999 }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: track,
        borderRadius: radius,
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          title={seg.title}
          style={{
            width: `${seg.value}%`,
            background: seg.color,
            // tiny dark gap between segments — keeps them distinguishable
            // without inventing a new visual.
            borderRight:
              i < segments.length - 1 && seg.value > 0 && seg.value < 100
                ? `1px solid ${SKAM.card}`
                : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ---------- EmptyState ---------------------------------------------------
// Calm one-line message + optional single action.
function EmptyState({ message, action, icon, dense = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: dense ? '20px 16px' : '36px 16px',
        textAlign: 'center',
      }}
    >
      {icon && <div style={{ color: SKAM.textDim, marginBottom: 2 }}>{icon}</div>}
      <div style={{ fontSize: 13, color: SKAM.text2, lineHeight: 1.5, maxWidth: 320 }}>
        {message}
      </div>
      {action}
    </div>
  );
}

// ---------- Button -------------------------------------------------------
// Small set: primary (red, only for primary action), secondary (outlined),
// ghost (text only). Sentence case.
function Button({ children, variant = 'secondary', size = 'sm', onClick, icon }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: size === 'md' ? 13 : 12,
    fontWeight: 500,
    padding: size === 'md' ? '8px 14px' : '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1,
    transition: 'background .12s, border-color .12s, color .12s',
  };
  const styles = {
    primary: {
      ...base,
      background: SKAM.red,
      color: '#fff',
      border: `0.5px solid ${SKAM.red}`,
    },
    secondary: {
      ...base,
      background: 'transparent',
      color: SKAM.text,
      border: `0.5px solid ${SKAM.border}`,
    },
    ghost: {
      ...base,
      background: 'transparent',
      color: SKAM.text2,
      border: '0.5px solid transparent',
      padding: size === 'md' ? '8px 10px' : '6px 8px',
    },
  };
  return (
    <button style={styles[variant]} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

// ---------- Icon helpers (tiny inline strokes) ---------------------------
const Icon = {
  arrow: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h6M6.5 3.5L9 6L6.5 8.5"/>
    </svg>
  ),
  check: (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.3L5 8.5L9.5 3.5"/>
    </svg>
  ),
  dot: (
    <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="2.5" fill="currentColor"/></svg>
  ),
  warn: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5L11 10.5H1L6 1.5z"/><path d="M6 5v2.5"/><circle cx="6" cy="9" r="0.4" fill="currentColor"/>
    </svg>
  ),
  search: (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/>
    </svg>
  ),
  inbox: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5"/>
      <path d="M2.5 9h3l1 1.5h3L10.5 9h3"/>
    </svg>
  ),
};

// ---------- DisciplineChip ----------------------------------------------
// Quiet discipline label on task cards. Same neutral feeling as ProjectTag
// but unbordered — a chip, not a tag — so the two roles read distinctly.
function DisciplineChip({ label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        color: SKAM.textMuted,
        background: 'rgba(168,168,174,0.08)',
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      {label}
    </span>
  );
}

// ---------- ViewSwitcher -------------------------------------------------
// Two-tab segmented control. Reused for Board / Timeline and elsewhere.
function ViewSwitcher({ value, options, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange && onChange(o.value)}
            style={{
              border: 0,
              background: active ? SKAM.card : 'transparent',
              color: active ? SKAM.text : SKAM.text2,
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? `0 0 0 0.5px ${SKAM.border}` : 'none',
              transition: 'background .12s, color .12s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Icon additions ------------------------------------------------
Object.assign(Icon, {
  link: (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7L7 5"/>
      <path d="M4 5.5L3 6.5a1.8 1.8 0 1 0 2.5 2.5L6.5 8"/>
      <path d="M8 6.5L9 5.5a1.8 1.8 0 1 0-2.5-2.5L5.5 4"/>
    </svg>
  ),
  lock: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1"/>
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/>
    </svg>
  ),
  plus: (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M6 2v8M2 6h8"/>
    </svg>
  ),
  close: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M3 3l6 6M9 3l-6 6"/>
    </svg>
  ),
  calendar: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="8" height="7" rx="1"/><path d="M4 2v2M8 2v2M2 5.5h8"/>
    </svg>
  ),
  filter: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h8L7 7v3l-2-1V7L2 3z"/>
    </svg>
  ),
});

Object.assign(window, {
  SKAM,
  Card,
  SectionHeader,
  PersonChip,
  StatusPill,
  ProjectTag,
  CapacityLight,
  CAPACITY,
  MetricCard,
  ProgressBar,
  EmptyState,
  Button,
  Icon,
  STATUS,
  DisciplineChip,
  ViewSwitcher,
});
