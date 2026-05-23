// Capacity-by-role section. Roles grouped by family; one row per role with
// a target-band bar showing actual headcount versus the desired range.

function CapacitySection({ families }) {
  return (
    <Card>
      <SectionHeader title="Capacity by role" meta="grouped by family" />
      <div>
        {families.map((fam, fi) => (
          <FamilyBlock key={fi} family={fam} first={fi === 0} />
        ))}
      </div>
    </Card>
  );
}

function FamilyBlock({ family, first }) {
  return (
    <div
      style={{
        borderTop: first ? 'none' : `0.5px solid ${SKAM.divider}`,
        padding: '14px 20px 18px 20px',
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 0,
      }}
    >
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 11, color: SKAM.textMuted, marginBottom: 2 }}>
          {family.label}
        </div>
        <div style={{ fontSize: 11, color: SKAM.textDim }}>
          {family.roles.length} roles
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {family.roles.map((role, ri) => (
          <RoleRow key={ri} role={role} />
        ))}
      </div>
    </div>
  );
}

// Single role row.
// Visual: name | range bar (with target band + colored fill) | count | light
function RoleRow({ role }) {
  // max scale on the bar = max(actual, range.max) + 1 small headroom
  const scaleMax = Math.max(role.actual, role.range[1]) + 1;
  const bandStart = (role.range[0] / scaleMax) * 100;
  const bandWidth = ((role.range[1] - role.range[0] + 1) / scaleMax) * 100;
  const fillWidth = (role.actual / scaleMax) * 100;

  const stateColor = CAPACITY[role.state];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr 80px 16px',
        alignItems: 'center',
        gap: 14,
        padding: '8px 0',
      }}
    >
      <div style={{ fontSize: 13, color: SKAM.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {role.name}
      </div>

      <div
        style={{
          position: 'relative',
          height: 12,
          borderRadius: 999,
          background: SKAM.inset,
          overflow: 'hidden',
        }}
      >
        {/* target band */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${bandStart}%`,
            width: `${bandWidth}%`,
            background: 'rgba(168,168,174,0.13)',
            borderLeft: `1px dashed ${SKAM.border}`,
            borderRight: `1px dashed ${SKAM.border}`,
          }}
        />
        {/* actual fill */}
        <div
          style={{
            position: 'absolute',
            top: 2,
            bottom: 2,
            left: 0,
            width: `${fillWidth}%`,
            background: stateColor,
            borderRadius: 999,
            opacity: 0.85,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          color: SKAM.text2,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: stateColor, fontWeight: 500 }}>
          {role.actual}
        </span>
        <span style={{ fontSize: 10, color: SKAM.textMuted }}>
          target {role.range[0]}–{role.range[1]}
        </span>
      </div>

      <CapacityLight state={role.state} />
    </div>
  );
}

Object.assign(window, { CapacitySection });
