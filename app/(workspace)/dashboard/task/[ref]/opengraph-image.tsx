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
  backlog: '#27272a',
  unscoped: '#27272a',
  todo: '#3f3f46',
  in_progress: '#0369a1',
  in_review: '#b45309',
  done: '#047857',
  canceled: '#52525b',
  duplicate: '#52525b'
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
            background: '#0a0a0a',
            color: '#a1a1aa',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
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
            'linear-gradient(135deg, #0a0a0a 0%, #18181b 60%, #1c1917 100%)',
          color: '#fafafa',
          padding: 64,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Top bar: wordmark + ref/project/due */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 18,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#a1a1aa'
          }}
        >
          <span style={{ color: '#fafafa', fontWeight: 700 }}>VERBIVORE</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ color: '#fafafa', fontWeight: 600 }}>
              {task.ref}
            </span>
            <span style={{ color: '#52525b' }}>·</span>
            <span>{task.project.name}</span>
            {task.dueDate && (
              <>
                <span style={{ color: '#52525b' }}>·</span>
                <span>Due {formatDate(task.dueDate)}</span>
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
            paddingTop: 40,
            paddingBottom: 40
          }}
        >
          <div
            style={{
              fontSize: task.title.length > 60 ? 56 : 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#fafafa'
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
                gap: 16,
                fontSize: 24,
                color: '#e4e4e7'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  background: '#3f3f46',
                  color: '#fafafa',
                  fontSize: 20,
                  fontWeight: 700
                }}
              >
                {initials(task.assignee.fullName)}
              </div>
              <span>{task.assignee.fullName}</span>
            </div>
          ) : (
            <span style={{ fontSize: 22, color: '#71717a' }}>Unassigned</span>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 26px',
              borderRadius: 9999,
              background: STATUS_BG[task.status] ?? '#3f3f46',
              color: '#fafafa',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.02em'
            }}
          >
            {STATUS_LABEL[task.status] ?? task.status}
          </div>
        </div>
      </div>
    ),
    size
  )
}
