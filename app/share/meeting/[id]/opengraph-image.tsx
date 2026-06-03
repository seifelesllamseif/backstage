import { ImageResponse } from 'next/og'
import { fetchMeetingForShare, type SharedMeeting } from '@/supabase/dashboard/meetings'

export const alt = 'Verbivore meeting share preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG_PAGE = '#FAFAF7'
const BG_CARD = '#FFFFFF'
const TEXT_PRIMARY = '#0E1414'
const TEXT_MUTED = '#566868'
const BORDER_SOFT = 'rgba(15, 20, 20, 0.08)'
const ACCENT_TEAL = '#00A89E'
const ACCENT_TEAL_TEXT = '#018A82'
const ACCENT_TEAL_TINT = 'rgba(0, 168, 158, 0.12)'

const STATUS_LABEL: Record<SharedMeeting['status'], string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  completed: 'Completed',
  rejected: 'Rejected',
  declined: 'Declined',
  canceled: 'Canceled'
}

const STATUS_BG: Record<SharedMeeting['status'], string> = {
  pending: '#FEF3C7',
  approved: '#E0F2FE',
  scheduled: '#D1FAE5',
  completed: '#F4F4F5',
  rejected: '#F4F4F5',
  declined: '#F4F4F5',
  canceled: '#F4F4F5'
}

const STATUS_FG: Record<SharedMeeting['status'], string> = {
  pending: '#92400E',
  approved: '#075985',
  scheduled: '#065F46',
  completed: '#3F3F46',
  rejected: '#71717A',
  declined: '#71717A',
  canceled: '#71717A'
}

function formatWhen(m: SharedMeeting): string {
  if (m.status === 'scheduled' && m.selectedStartsAt) {
    try {
      return new Date(m.selectedStartsAt).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return m.selectedStartsAt
    }
  }
  if (m.proposedDate) {
    try {
      return new Date(`${m.proposedDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return m.proposedDate
    }
  }
  return ''
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
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const meeting = await fetchMeetingForShare(id)

  if (!meeting) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: BG_PAGE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            color: TEXT_MUTED,
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          Meeting not found
        </div>
      ),
      size
    )
  }

  const when = formatWhen(meeting)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG_PAGE,
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {/* Brand strip */}
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
              gap: 12,
              color: ACCENT_TEAL_TEXT,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 1
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 14,
                background: ACCENT_TEAL
              }}
            />
            VERBIVORE
          </div>
          <div
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              background: STATUS_BG[meeting.status],
              color: STATUS_FG[meeting.status],
              fontSize: 22,
              fontWeight: 600
            }}
          >
            {STATUS_LABEL[meeting.status]}
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            marginTop: 36,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: BG_CARD,
            border: `1px solid ${BORDER_SOFT}`,
            borderRadius: 32,
            padding: 56
          }}
        >
          {when && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 26,
                color: TEXT_MUTED
              }}
            >
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: ACCENT_TEAL_TINT,
                  color: ACCENT_TEAL_TEXT,
                  fontWeight: 600
                }}
              >
                {when}
              </div>
              <div>· {meeting.durationMin} min</div>
            </div>
          )}

          <div
            style={{
              marginTop: 30,
              fontSize: 64,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              lineHeight: 1.1
            }}
          >
            {meeting.title.length > 90
              ? meeting.title.slice(0, 87) + '...'
              : meeting.title}
          </div>

          {/* Attendees */}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 20
            }}
          >
            <AttendeeChip
              name={meeting.requesterName}
              avatarUrl={meeting.requesterAvatarUrl}
            />
            <div style={{ color: TEXT_MUTED, fontSize: 28 }}>↔</div>
            <AttendeeChip
              name={
                meeting.attendees.length === 1
                  ? meeting.attendees[0].fullName
                  : `${meeting.attendees[0]?.fullName ?? 'someone'} + ${meeting.attendees.length - 1} more`
              }
              avatarUrl={meeting.attendees[0]?.avatarUrl ?? null}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            color: TEXT_MUTED,
            fontSize: 20,
            letterSpacing: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 6,
              background: ACCENT_TEAL
            }}
          />
          MEETING ON BACKSTAGE
        </div>
      </div>
    ),
    size
  )
}

function AttendeeChip({
  name,
  avatarUrl
}: {
  name: string
  avatarUrl: string | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          width={64}
          height={64}
          alt=""
          style={{
            width: 64,
            height: 64,
            borderRadius: 64,
            objectFit: 'cover'
          }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 64,
            background: ACCENT_TEAL_TINT,
            color: ACCENT_TEAL_TEXT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700
          }}
        >
          {initials(name)}
        </div>
      )}
      <div style={{ fontSize: 28, color: TEXT_PRIMARY, fontWeight: 600 }}>
        {name}
      </div>
    </div>
  )
}
