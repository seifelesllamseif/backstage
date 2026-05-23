// Project header — shown above the Board / Timeline view switcher.
// Reuses ProjectTag, PersonChip, CapacityLight from §5. No new patterns.

function ProjectHeader({ project, view, onViewChange }) {
  return (
    <div
      style={{
        padding: '20px 32px 16px 32px',
        borderBottom: `0.5px solid ${SKAM.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* row 1 — project identity + view switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11,
              color: SKAM.textMuted,
              fontWeight: 500,
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: 4,
              background: SKAM.inset,
              border: `0.5px solid ${SKAM.border}`,
            }}
          >
            {project.key}
          </span>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: SKAM.text,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {project.name}
          </h1>
          {project.status && (
            <span
              style={{
                fontSize: 11,
                color: SKAM.text2,
                background: SKAM.inset,
                padding: '3px 8px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.success }} />
              {project.status}
            </span>
          )}
        </div>
        <ViewSwitcher
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'timeline', label: 'Timeline' },
          ]}
        />
      </div>

      {/* row 2 — dates + role demand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: SKAM.textMuted, display: 'inline-flex' }}>{Icon.calendar}</span>
          <span style={{ fontSize: 12, color: SKAM.text2 }}>
            {project.dates}
          </span>
        </div>

        {project.leads && project.leads.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: SKAM.textMuted }}>Leads</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {project.leads.map((l, i) => (
                <PersonChip key={i} name={l} />
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 12, color: SKAM.textMuted, marginRight: 2 }}>
            Roles
          </span>
          {project.roles.map((r, i) => (
            <RoleNeed key={i} role={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Tiny role-demand chip: light + role + filled / target. Reuses CapacityLight
// so the meaning is identical to the Crew Board.
function RoleNeed({ role }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        padding: '3px 8px 3px 8px',
        borderRadius: 999,
        fontSize: 11,
        color: SKAM.text2,
      }}
    >
      <CapacityLight state={role.state} size={6} />
      <span style={{ color: SKAM.text }}>{role.name}</span>
      <span
        style={{
          color:
            role.state === 'critical'
              ? SKAM.red
              : role.state === 'under'
              ? SKAM.warning
              : SKAM.textMuted,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {role.filled}/{role.target}
      </span>
    </span>
  );
}

Object.assign(window, { ProjectHeader });
