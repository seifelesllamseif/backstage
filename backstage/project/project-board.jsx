// Project board — kanban-ish columns by status.
// Columns: Backlog, Unscoped, To do, In progress, In review, Done.

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'unscoped', label: 'Unscoped' },
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'in_review', label: 'In review' },
  { key: 'done', label: 'Done' }
]

function ProjectBoard({
  project,
  tasks,
  onOpenTask,
  openTaskId,
  blockedTaskId
}) {
  // bucket tasks by status
  const buckets = {}
  BOARD_COLUMNS.forEach((c) => (buckets[c.key] = []))
  tasks.forEach((t) => {
    ;(buckets[t.status] || (buckets[t.status] = [])).push(t)
  })

  const empty = tasks.length === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }}
    >
      {/* Board toolbar */}
      <div
        style={{
          padding: '12px 32px',
          borderBottom: `0.5px solid ${SKAM.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <FilterChip label="Assignee" value="Anyone" />
        <FilterChip label="Discipline" value="All" />
        <FilterChip label="Due" value="Anytime" />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: SKAM.textMuted }}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
        <Button variant="secondary" icon={Icon.plus}>
          New task
        </Button>
      </div>

      {empty ? (
        <EmptyProject project={project} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(220px, 1fr))`,
            gap: 12,
            padding: '16px 32px 32px 32px',
            overflowX: 'auto',
            alignItems: 'start'
          }}
        >
          {BOARD_COLUMNS.map((col) => (
            <BoardColumn
              key={col.key}
              column={col}
              items={buckets[col.key] || []}
              onOpenTask={onOpenTask}
              openTaskId={openTaskId}
              blockedTaskId={blockedTaskId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, value }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: SKAM.inset,
        border: `0.5px solid ${SKAM.border}`,
        color: SKAM.text2,
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }}
    >
      <span style={{ color: SKAM.textMuted }}>{label}</span>
      <span style={{ color: SKAM.text }}>{value}</span>
      <svg
        width="8"
        height="8"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: SKAM.textMuted }}
      >
        <path d="M3 4l2 2 2-2" />
      </svg>
    </button>
  )
}

function BoardColumn({ column, items, onOpenTask, openTaskId, blockedTaskId }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 4px'
        }}
      >
        <StatusPill status={column.key} />
        <span
          style={{
            fontSize: 11,
            color: SKAM.textDim,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {items.length}
        </span>
        <span style={{ flex: 1 }} />
        <button
          style={{
            background: 'transparent',
            border: 0,
            color: SKAM.textMuted,
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 2,
            borderRadius: 4
          }}
          title="Add"
        >
          {Icon.plus}
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 80
        }}
      >
        {items.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            open={t.id === openTaskId}
            blocked={t.id === blockedTaskId}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, open, blocked, onOpenTask }) {
  const overdue = task.overdue
  const borderColor = blocked ? SKAM.red : open ? SKAM.text2 : SKAM.border
  return (
    <div
      onClick={() => onOpenTask && onOpenTask(task.id)}
      style={{
        background: SKAM.card,
        border: `0.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: blocked
          ? `0 0 0 2px ${SKAM.redTintHi}`
          : open
            ? `0 0 0 1px ${SKAM.hover}`
            : 'none'
      }}
    >
      {/* id row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            color: SKAM.textDim,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {task.id}
        </span>
        {task.hasDeps && (
          <span
            style={{ color: SKAM.textMuted, display: 'inline-flex' }}
            title="Has dependencies"
          >
            {Icon.link}
          </span>
        )}
        {task.handoffIncomplete && task.status !== 'done' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: SKAM.warning,
              background: 'rgba(239,159,39,0.10)',
              padding: '1px 6px',
              borderRadius: 4,
              marginLeft: 'auto'
            }}
          >
            handoff
          </span>
        )}
      </div>

      {/* title */}
      <div
        style={{
          fontSize: 13,
          color: SKAM.text,
          lineHeight: 1.35,
          fontWeight: 400
        }}
      >
        {task.title}
      </div>

      {/* discipline chips */}
      {task.disciplines && task.disciplines.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {task.disciplines.map((d, i) => (
            <DisciplineChip key={i} label={d} />
          ))}
        </div>
      )}

      {/* footer: assignee + due */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
          gap: 8
        }}
      >
        {task.assignee ? (
          <PersonChip name={task.assignee} />
        ) : (
          <span style={{ fontSize: 11, color: SKAM.textDim }}>Unassigned</span>
        )}
        {task.due && (
          <span
            style={{
              fontSize: 11,
              color: overdue ? SKAM.red : SKAM.textMuted,
              fontWeight: overdue ? 500 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {overdue && (
              <span style={{ color: SKAM.red, display: 'inline-flex' }}>
                {Icon.warn}
              </span>
            )}
            {task.due}
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyProject({ project }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 32px'
      }}
    >
      <Card style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              margin: '0 auto 14px',
              borderRadius: 8,
              background: SKAM.inset,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: SKAM.text2
            }}
          >
            {Icon.inbox}
          </div>
          <div
            style={{
              fontSize: 15,
              color: SKAM.text,
              fontWeight: 500,
              marginBottom: 6
            }}
          >
            {project.name} has no tasks yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: SKAM.text2,
              lineHeight: 1.5,
              marginBottom: 18
            }}
          >
            Start by adding the first thing the team needs to do. Drop it in
            Unscoped if you're still figuring out the brief.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button variant="primary" icon={Icon.plus}>
              New task
            </Button>
            <Button variant="secondary">Import from a list</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

Object.assign(window, { ProjectBoard, BOARD_COLUMNS })
