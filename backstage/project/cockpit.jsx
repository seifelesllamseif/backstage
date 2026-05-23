// Crew Cockpit — design.md §6.1 + crew-cockpit-build-spec.md
// Single-column, 980px max, five stacked blocks. Each state has its own data
// payload below; the rendering is one component.

// ---------- Header strip --------------------------------------------------
function HeaderStrip({ me }) {
  const subline = [me.role, me.contract, me.lifecycleLabel].filter(Boolean).join(' · ');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '4px 4px 4px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <PersonChip name={me.name} self size="lg" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 2 }}>
          <span style={{ fontSize: 12, color: SKAM.textMuted, fontWeight: 400 }}>
            {subline}
          </span>
        </div>
      </div>
      {me.tenure && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: SKAM.text2,
          }}
        >
          <span style={{ color: SKAM.text }}>
            {me.tenure.label}
          </span>
          <span style={{ color: SKAM.textDim }}>·</span>
          <span style={{ color: SKAM.textMuted }}>
            ends {me.tenure.endsOn}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- Onboarding tracker -------------------------------------------
function OnboardingTracker({ onboarding }) {
  const done = onboarding.steps.filter((s) => s.state === 'done').length;
  const total = onboarding.steps.length;
  const inProg = onboarding.steps.find((s) => s.state === 'in_progress');
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 8px 20px',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: SKAM.text, margin: 0 }}>
            Onboarding
          </h2>
          <span style={{ fontSize: 12, color: SKAM.textMuted }}>
            {done} of {total} steps · mentor {onboarding.mentor}
          </span>
        </div>
        {inProg && (
          <span style={{ fontSize: 12, color: SKAM.text2 }}>
            Up next: <span style={{ color: SKAM.text }}>{inProg.label}</span>
          </span>
        )}
      </div>

      {/* progress bar — red because it's the person's identity progress, per §3.5 */}
      <div style={{ padding: '4px 20px 14px 20px' }}>
        <ProgressBar
          segments={[
            { value: (done / total) * 100, color: SKAM.red, title: 'done' },
          ]}
        />
      </div>

      {/* step pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '0 20px 18px 20px',
        }}
      >
        {onboarding.steps.map((s, i) => (
          <StepPill key={i} step={s} />
        ))}
      </div>
    </Card>
  );
}

function StepPill({ step }) {
  const isDone = step.state === 'done';
  const isProg = step.state === 'in_progress';
  let color = SKAM.textMuted;
  let bg = SKAM.inset;
  let icon = null;
  let border = `0.5px solid ${SKAM.border}`;
  if (isDone) {
    color = SKAM.text2;
    bg = 'transparent';
    icon = <span style={{ color: SKAM.success, display: 'inline-flex' }}>{Icon.check}</span>;
  } else if (isProg) {
    color = SKAM.text;
    bg = 'rgba(226,75,74,0.10)';
    border = `0.5px solid rgba(226,75,74,0.35)`;
    icon = (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: SKAM.red,
          display: 'inline-block',
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        border,
        color,
        fontSize: 12,
        fontWeight: isProg ? 500 : 400,
        textDecoration: isDone ? 'line-through' : 'none',
        textDecorationColor: SKAM.textDim,
      }}
    >
      {icon}
      {step.label}
    </span>
  );
}

// ---------- My tasks ------------------------------------------------------
function MyTasks({ tasks }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHeader
        title="My tasks"
        meta={
          tasks.length > 0 && (
            <a
              href="#"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: SKAM.text2,
                textDecoration: 'none',
              }}
            >
              View board {Icon.arrow}
            </a>
          )
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          message="No open tasks. When work is assigned to you, it shows up here."
        />
      ) : (
        <div>
          {tasks.map((t, i) => (
            <TaskRow key={i} task={t} last={i === tasks.length - 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TaskRow({ task, last }) {
  const overdue = task.overdue;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        borderTop: `0.5px solid ${SKAM.divider}`,
        // first row gets no top border because the SectionHeader already
        // separates it visually.
      }}
    >
      <StatusPill status={task.status} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 13,
            color: SKAM.text,
            fontWeight: 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ProjectTag name={task.project} />
          <span style={{ fontSize: 11, color: SKAM.textMuted }}>·</span>
          {task.with ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: SKAM.textMuted,
              }}
            >
              with <PersonChip name={task.with} />
            </span>
          ) : (
            <span style={{ fontSize: 11, color: SKAM.textMuted }}>solo</span>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: overdue ? SKAM.red : SKAM.text2,
          textAlign: 'right',
          minWidth: 80,
          fontWeight: overdue ? 500 : 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
        }}
      >
        {overdue && <span style={{ color: SKAM.red, display: 'inline-flex' }}>{Icon.warn}</span>}
        {task.due}
      </div>
    </div>
  );
}

// ---------- My allocation ------------------------------------------------
function MyAllocation({ allocation }) {
  const total = allocation.total;
  const over = total > 100;
  const lines = allocation.projects;

  // build progress segments. cap each at its share; if total>100 the red
  // overflow segment shows the excess, which is the early-warning signal.
  const cap = Math.max(total, 100);
  const segments = lines.map((l) => ({
    value: (l.percent / cap) * 100,
    color: over ? '#5C5C62' : l.color || SKAM.info,
    title: `${l.project} ${l.percent}%`,
  }));
  if (over) {
    segments.push({
      value: ((total - 100) / cap) * 100,
      color: SKAM.red,
      title: `overload ${total - 100}%`,
    });
  }

  return (
    <Card>
      <SectionHeader title="My allocation" />

      <div style={{ padding: '0 20px 16px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: over ? SKAM.red : SKAM.text,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {total}%
            </span>
            <span style={{ fontSize: 12, color: SKAM.textMuted }}>this week</span>
          </div>
          {over && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: SKAM.red,
                fontSize: 11,
                fontWeight: 500,
                background: 'rgba(226,75,74,0.10)',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: SKAM.red }} />
              Overloaded
            </span>
          )}
        </div>

        <ProgressBar segments={segments} height={6} />

        {/* over-100 axis cue */}
        {over && (
          <div
            style={{
              position: 'relative',
              height: 1,
              margin: '4px 0 12px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${(100 / cap) * 100}%`,
                top: -3,
                bottom: -3,
                width: 1,
                background: SKAM.textDim,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `calc(${(100 / cap) * 100}% - 14px)`,
                top: 4,
                fontSize: 10,
                color: SKAM.textMuted,
              }}
            >
              100%
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: over ? 14 : 12, gap: 8 }}>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: over ? '#5C5C62' : (l.color || SKAM.info),
                  flex: '0 0 auto',
                }}
              />
              <span style={{ color: SKAM.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.project}
              </span>
              <span style={{ color: SKAM.text2, fontVariantNumeric: 'tabular-nums' }}>
                {l.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------- Handoffs ------------------------------------------------------
function Handoffs({ handoffs }) {
  const { toFill, received } = handoffs;
  const isEmpty = toFill.length === 0 && received.length === 0;
  return (
    <Card>
      <SectionHeader title="Handoffs" />
      {isEmpty ? (
        <EmptyState message="No handoffs waiting on you. You're clear." dense />
      ) : (
        <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <HandoffGroup
            label="To fill"
            count={toFill.length}
            items={toFill}
            direction="out"
          />
          <HandoffGroup
            label="Received"
            count={received.length}
            items={received}
            direction="in"
          />
        </div>
      )}
    </Card>
  );
}

function HandoffGroup({ label, count, items, direction }) {
  if (items.length === 0) {
    return (
      <div>
        <GroupLabel label={label} count={0} />
        <div style={{ fontSize: 12, color: SKAM.textMuted, marginTop: 4 }}>None right now.</div>
      </div>
    );
  }
  return (
    <div>
      <GroupLabel label={label} count={count} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {items.map((h, i) => (
          <HandoffItem key={i} item={h} direction={direction} />
        ))}
      </div>
    </div>
  );
}

function GroupLabel({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11, color: SKAM.textMuted, textTransform: 'none' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: SKAM.textDim }}>{count}</span>
    </div>
  );
}

function HandoffItem({ item, direction }) {
  return (
    <div
      style={{
        background: SKAM.inset,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: SKAM.text,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.task}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: SKAM.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {direction === 'out' ? 'to' : 'from'}
        </span>
        <PersonChip name={item.other} />
        {item.blocksDone && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: SKAM.warning,
              background: 'rgba(239,159,39,0.10)',
              padding: '2px 6px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            blocks Done
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- My roadmap ---------------------------------------------------
// Six-week horizon; weeks across the top; milestones as bars.
function MyRoadmap({ roadmap }) {
  const weeks = roadmap.weeks; // [{label, startISO}] x6
  const today = roadmap.todayCol; // 0..5 fractional col

  return (
    <Card>
      <SectionHeader title="My roadmap" meta="my milestones only · next 6 weeks" />
      <div style={{ padding: '0 20px 20px 20px' }}>
        {/* weeks header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(6, 1fr)`,
            columnGap: 0,
            borderBottom: `0.5px solid ${SKAM.divider}`,
            paddingBottom: 8,
          }}
        >
          <div />
          {weeks.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: SKAM.textMuted,
                paddingLeft: 6,
                borderLeft: i === 0 ? 'none' : `0.5px solid ${SKAM.divider}`,
              }}
            >
              {w.label}
            </div>
          ))}
        </div>

        {/* rows */}
        <div style={{ position: 'relative' }}>
          {/* today line */}
          <div
            style={{
              position: 'absolute',
              left: `calc(120px + ${(today / 6) * 100}% * (100% - 120px) / 100%)`,
              // simpler: use grid track. Replace with overlay below.
            }}
          />
          {roadmap.milestones.length === 0 ? (
            <EmptyState
              message="No milestones in the next six weeks. Yours will appear here when your project leads schedule them."
              dense
            />
          ) : (
            roadmap.milestones.map((m, i) => (
              <RoadmapRow key={i} milestone={m} weeks={weeks} today={today} />
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function RoadmapRow({ milestone, weeks, today }) {
  // milestone has {title, project, startCol, endCol, status}
  // grid columns: label 120px, then 6 equal week columns. We render a
  // bar that spans startCol..endCol.
  const color =
    milestone.status === 'at_risk'
      ? SKAM.warning
      : milestone.status === 'done'
      ? SKAM.success
      : SKAM.info;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `120px repeat(6, 1fr)`,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `0.5px solid ${SKAM.divider}`,
        position: 'relative',
      }}
    >
      {/* week dividers */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(120px + (100% - 120px) * ${i / 6})`,
            width: 1,
            background: SKAM.divider,
            opacity: 0.6,
          }}
        />
      ))}
      {/* today line */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: `calc(120px + (100% - 120px) * ${today / 6})`,
          width: 1,
          background: SKAM.red,
          opacity: 0.5,
        }}
      />

      <div
        style={{
          fontSize: 12,
          color: SKAM.text,
          paddingRight: 12,
          minWidth: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        title={milestone.title}
      >
        <span>{milestone.title}</span>
        <span style={{ fontSize: 10, color: SKAM.textMuted }}>{milestone.project}</span>
      </div>

      {/* bar spans across week columns */}
      <div
        style={{
          gridColumn: `${2 + milestone.startCol} / span ${milestone.endCol - milestone.startCol + 1}`,
          height: 6,
          background: color,
          borderRadius: 4,
          margin: '0 4px',
          position: 'relative',
        }}
      >
        {/* milestone diamond at end */}
        <div
          style={{
            position: 'absolute',
            right: -3,
            top: -1,
            width: 8,
            height: 8,
            transform: 'rotate(45deg)',
            background: color,
          }}
        />
      </div>
    </div>
  );
}

// ---------- Wrapping-up nudge --------------------------------------------
function WrappingUpNudge({ daysLeft }) {
  return (
    <div
      style={{
        background: 'rgba(239,159,39,0.07)',
        border: `0.5px solid rgba(239,159,39,0.30)`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ color: SKAM.warning, display: 'inline-flex' }}>{Icon.warn}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: SKAM.text, fontWeight: 500 }}>
          You wrap up in {daysLeft} days. Finish your handoffs.
        </div>
        <div style={{ fontSize: 12, color: SKAM.text2, marginTop: 2 }}>
          Make sure every open task has a filled handoff so the next person can pick it up cleanly.
        </div>
      </div>
      <Button variant="secondary">
        Open handoffs
      </Button>
    </div>
  );
}

// ---------- Cockpit (top-level layout) -----------------------------------
function Cockpit({ data }) {
  const { me, onboarding, tasks, allocation, handoffs, roadmap, wrappingUp } = data;
  const showOnboarding = !!onboarding;

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '28px 32px 60px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <HeaderStrip me={me} />

      {wrappingUp && <WrappingUpNudge daysLeft={wrappingUp.daysLeft} />}

      {showOnboarding && <OnboardingTracker onboarding={onboarding} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <MyTasks tasks={tasks} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MyAllocation allocation={allocation} />
          <Handoffs handoffs={handoffs} />
        </div>
      </div>

      <MyRoadmap roadmap={roadmap} />

      <SpotlightBlock spotlight={data.spotlight} viewerName={me.name} />
    </div>
  );
}

Object.assign(window, { Cockpit });
