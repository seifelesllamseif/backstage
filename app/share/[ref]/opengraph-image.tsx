import { ImageResponse } from 'next/og'
import { fetchTaskByRef } from '@/supabase/dashboard/fetchTaskByRef'

export const alt = 'Verbivore task share preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  unscoped: 'Unscoped',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  canceled: 'Canceled',
  duplicate: 'Duplicate'
}

const STATUS_BG: Record<string, string> = {
  backlog: '#2C3737',
  unscoped: '#2C3737',
  todo: '#EDE8DC',
  in_progress: '#0369A1',
  in_review: '#B45309',
  done: '#047857',
  canceled: '#52525B',
  duplicate: '#52525B'
}

const STATUS_FG: Record<string, string> = {
  backlog: '#EDE8DC',
  unscoped: '#EDE8DC',
  todo: '#0E1414',
  in_progress: '#FFFFFF',
  in_review: '#FFFFFF',
  done: '#FFFFFF',
  canceled: '#FFFFFF',
  duplicate: '#FFFFFF'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function OG({
  params
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const task = await fetchTaskByRef(ref)

  if (!task) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: '#0E1414',
            color: '#7A8B8B',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.02em'
          }}
        >
          Task not found
        </div>
      ),
      size
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(135deg, #0E1414 0%, #1A2424 55%, #22302F 100%)',
          color: '#EDE8DC',
          padding: 72,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative'
        }}
      >
        {/* Verbivore teal accent corner */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: -120,
            right: -120,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: 'rgba(0, 168, 158, 0.18)',
            filter: 'blur(40px)'
          }}
        />
        {/* Soft amber bottom accent */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: -140,
            left: -100,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background: 'rgba(239, 159, 39, 0.10)',
            filter: 'blur(50px)'
          }}
        />

        {/* Top bar: wordmark + ref pill + project */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#EDE8DC'
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 9999,
                background: '#00A89E'
              }}
            />
            VERBIVORE
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 22,
              color: '#B5C0C0',
              letterSpacing: '0.05em'
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 9999,
                background: 'rgba(0, 168, 158, 0.18)',
                color: '#5DE1D6',
                fontWeight: 700,
                letterSpacing: '0.12em'
              }}
            >
              {task.ref}
            </span>
            <span style={{ color: '#B5C0C0' }}>{task.project.name}</span>
            {task.dueDate && (
              <>
                <span style={{ color: '#566868' }}>·</span>
                <span style={{ color: '#B5C0C0' }}>
                  Due {formatDate(task.dueDate)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Title - the focal element */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            paddingTop: 48,
            paddingBottom: 48
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: task.title.length > 60 ? 60 : 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              color: '#EDE8DC'
            }}
          >
            {task.title}
          </div>
        </div>

        {/* Bottom row: assignee + status chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {task.assignee ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                fontSize: 24,
                color: '#EDE8DC'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 60,
                  height: 60,
                  borderRadius: 9999,
                  background:
                    'linear-gradient(135deg, #00A89E 0%, #018A82 100%)',
                  color: '#EDE8DC',
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '0.02em'
                }}
              >
                {initials(task.assignee.fullName)}
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <span
                  style={{
                    display: 'flex',
                    fontSize: 12,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: '#7A8B8B'
                  }}
                >
                  Assignee
                </span>
                <span
                  style={{ display: 'flex', fontSize: 24, color: '#EDE8DC' }}
                >
                  {task.assignee.fullName}
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                color: '#566868',
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}
            >
              Unassigned
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 26px',
              borderRadius: 9999,
              background: STATUS_BG[task.status] ?? '#3F3F46',
              color: STATUS_FG[task.status] ?? '#FFFFFF',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.04em'
            }}
          >
            <span
              style={{
                display: 'flex',
                width: 10,
                height: 10,
                borderRadius: 9999,
                background: STATUS_FG[task.status] ?? '#FFFFFF',
                opacity: 0.85
              }}
            />
            {STATUS_LABEL[task.status] ?? task.status}
          </div>
        </div>
      </div>
    ),
    size
  )
}
