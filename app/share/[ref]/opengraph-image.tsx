import { ImageResponse } from 'next/og'
import { fetchTaskByRef } from '@/supabase/dashboard/fetchTaskByRef'

export const alt = 'Verbivore task share preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Verbivore palette
const BG_PAGE = '#FAFAF7'
const BG_CARD = '#FFFFFF'
const TEXT_PRIMARY = '#0E1414'
const TEXT_MUTED = '#566868'
const TEXT_SUBTLE = '#7A8B8B'
const BORDER_SOFT = 'rgba(15, 20, 20, 0.08)'
const ACCENT_TEAL = '#00A89E'
const ACCENT_TEAL_TEXT = '#018A82'
const ACCENT_TEAL_TINT = 'rgba(0, 168, 158, 0.12)'
const ACCENT_AMBER_TINT = 'rgba(239, 159, 39, 0.16)'

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
  backlog: '#F4F4F5',
  unscoped: '#F4F4F5',
  todo: '#0E1414',
  in_progress: '#E0F2FE',
  in_review: '#FEF3C7',
  done: '#D1FAE5',
  canceled: '#F4F4F5',
  duplicate: '#F4F4F5'
}

const STATUS_FG: Record<string, string> = {
  backlog: '#3F3F46',
  unscoped: '#3F3F46',
  todo: '#FAFAF7',
  in_progress: '#075985',
  in_review: '#92400E',
  done: '#065F46',
  canceled: '#71717A',
  duplicate: '#71717A'
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
            background: BG_PAGE,
            color: TEXT_SUBTLE,
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
          background: BG_PAGE,
          color: TEXT_PRIMARY,
          padding: 72,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative'
        }}
      >
        {/* Teal accent corner */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: ACCENT_TEAL_TINT,
            filter: 'blur(60px)'
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
            background: ACCENT_AMBER_TINT,
            filter: 'blur(70px)'
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
              color: TEXT_PRIMARY
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 9999,
                background: ACCENT_TEAL
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
              color: TEXT_MUTED,
              letterSpacing: '0.05em'
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 9999,
                background: ACCENT_TEAL_TINT,
                color: ACCENT_TEAL_TEXT,
                fontWeight: 700,
                letterSpacing: '0.12em'
              }}
            >
              {task.ref}
            </span>
            <span style={{ color: TEXT_MUTED }}>{task.project.name}</span>
            {task.dueDate && (
              <>
                <span style={{ color: TEXT_SUBTLE }}>·</span>
                <span style={{ color: TEXT_MUTED }}>
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
              color: TEXT_PRIMARY
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
            justifyContent: 'space-between',
            paddingTop: 24,
            borderTop: `1px solid ${BORDER_SOFT}`
          }}
        >
          {task.assignee ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                fontSize: 24,
                color: TEXT_PRIMARY
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
                  color: BG_CARD,
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
                    color: TEXT_SUBTLE
                  }}
                >
                  Assignee
                </span>
                <span
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    color: TEXT_PRIMARY
                  }}
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
                color: TEXT_SUBTLE,
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
              background: STATUS_BG[task.status] ?? '#F4F4F5',
              color: STATUS_FG[task.status] ?? TEXT_PRIMARY,
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
                background: STATUS_FG[task.status] ?? TEXT_PRIMARY,
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
