import 'server-only'

// Minimal HTML/text builders for transactional emails. Keep CSS inline
// and content layout flat (no nested tables, no images): clients like
// Outlook and Gmail behave best when the markup looks like a 2002
// landing page. Every helper returns { subject, html, text } so the
// caller hands the whole thing straight to sendEmail.

const BASE_STYLES = [
  'font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif',
  'color:#111',
  'max-width:560px',
  'margin:0 auto',
  'padding:24px 16px'
].join(';')

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shell(opts: {
  preheader: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  unsubscribeUrl?: string
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:20px 0"><a href="${escape(opts.ctaUrl)}" style="background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">${escape(opts.ctaLabel)}</a></p>`
      : ''
  const unsubscribe = opts.unsubscribeUrl
    ? `<p style="margin-top:32px;font-size:11px;color:#999"><a href="${escape(opts.unsubscribeUrl)}" style="color:#999">Unsubscribe</a> from Backstage emails. You can also manage categories in Dashboard - Settings.</p>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fafafa"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(opts.preheader)}</div><div style="${BASE_STYLES}">${opts.bodyHtml}${cta}${unsubscribe}</div></body></html>`
}

export interface MentionEmailInput {
  recipientName: string
  authorName: string
  taskRef: string
  taskTitle: string
  commentBody: string
  taskUrl: string
  unsubscribeUrl?: string
}

export function mentionEmail(input: MentionEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `${input.authorName} mentioned you on ${input.taskRef}`
  const trimmedBody =
    input.commentBody.length > 800
      ? input.commentBody.slice(0, 797) + '...'
      : input.commentBody

  const html = shell({
    preheader: `${input.authorName} mentioned you on ${input.taskRef} - ${input.taskTitle}`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.authorName)}</strong> mentioned you on <a href="${escape(input.taskUrl)}" style="color:#0f766e">${escape(input.taskRef)} - ${escape(input.taskTitle)}</a>.</p>` +
      `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #0f766e;background:#f4f4f5;color:#444;white-space:pre-wrap">${escape(trimmedBody)}</blockquote>`,
    ctaLabel: 'Open task',
    ctaUrl: input.taskUrl,
    unsubscribeUrl: input.unsubscribeUrl
  })

  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.authorName} mentioned you on ${input.taskRef} - ${input.taskTitle}.`,
    '',
    trimmedBody,
    '',
    `Open task: ${input.taskUrl}`,
    input.unsubscribeUrl ? `\nUnsubscribe: ${input.unsubscribeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

function formatProposedDate(dateIso: string): string {
  // dateIso is YYYY-MM-DD. Parse as local-noon so timezone shifts don't
  // bump the displayed weekday.
  const d = new Date(`${dateIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateIso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(d)
}

function formatSlotList(
  slots: string[],
  durationMin: number,
  timezone?: string | null
): string[] {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone ?? undefined,
    timeZoneName: 'short'
  }
  return slots.map((iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${new Intl.DateTimeFormat('en-US', opts).format(d)} (${durationMin} min)`
  })
}

export interface MeetingRequestEmailInput {
  recipientName: string
  requesterName: string
  requesteeName: string
  title: string
  agenda?: string | null
  durationMin: number
  mode: 'day' | 'slots'
  // Set when mode='day'.
  proposedDate?: string | null
  // Set when mode='slots'.
  slotIsos?: string[] | null
  approvalUrl: string
  recipientTimezone?: string | null
  unsubscribeUrl?: string
}

export function meetingRequestSubmittedEmail(
  input: MeetingRequestEmailInput
): { subject: string; html: string; text: string } {
  const subject = `Meeting request: ${input.requesterName} - ${input.requesteeName}`
  const agendaHtml = input.agenda
    ? `<p style="margin:0 0 12px;color:#444"><strong>Agenda:</strong> ${input.agenda.replace(/</g, '&lt;')}</p>`
    : ''

  let timingHtml: string
  let timingText: string[]
  let preheaderTiming: string
  if (input.mode === 'day' && input.proposedDate) {
    const dateLabel = formatProposedDate(input.proposedDate)
    timingHtml =
      `<p style="margin:0 0 12px"><strong>Proposed day:</strong> ${escape(dateLabel)} (${input.durationMin} min)</p>` +
      `<p style="margin:0 0 12px;color:#666">The requestee will pick a specific time on that day.</p>`
    timingText = [`Proposed day: ${dateLabel} (${input.durationMin} min)`]
    preheaderTiming = `on ${dateLabel}`
  } else {
    const list = formatSlotList(
      input.slotIsos ?? [],
      input.durationMin,
      input.recipientTimezone
    )
    const slotsHtml = list
      .map(
        (s) =>
          `<li style="margin:4px 0;color:#333">${s.replace(/</g, '&lt;')}</li>`
      )
      .join('')
    timingHtml =
      `<p style="margin:0 0 6px"><strong>Proposed slots (${input.durationMin} min):</strong></p>` +
      `<ul style="margin:0 0 12px;padding-left:20px">${slotsHtml}</ul>`
    timingText = [
      `Proposed slots (${input.durationMin} min):`,
      ...list.map((s, i) => `${i + 1}. ${s}`)
    ]
    preheaderTiming = `with ${list.length} proposed slots`
  }

  const html = shell({
    preheader: `${input.requesterName} wants to meet with ${input.requesteeName} ${preheaderTiming}`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.requesterName)}</strong> requested a meeting with <strong>${escape(input.requesteeName)}</strong>.</p>` +
      `<p style="margin:0 0 12px"><strong>Title:</strong> ${escape(input.title)}</p>` +
      agendaHtml +
      timingHtml,
    ctaLabel: 'Review and approve',
    ctaUrl: input.approvalUrl,
    unsubscribeUrl: input.unsubscribeUrl
  })
  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.requesterName} requested a meeting with ${input.requesteeName}.`,
    `Title: ${input.title}`,
    input.agenda ? `Agenda: ${input.agenda}` : '',
    '',
    ...timingText,
    '',
    `Approve or reject: ${input.approvalUrl}`,
    input.unsubscribeUrl ? `\nUnsubscribe: ${input.unsubscribeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export interface MeetingApprovedEmailInput {
  recipientName: string
  requesterName: string
  title: string
  agenda?: string | null
  durationMin: number
  mode: 'day' | 'slots'
  proposedDate?: string | null
  slotIsos?: string[] | null
  pickUrl: string
  recipientTimezone?: string | null
  unsubscribeUrl?: string
}

export function meetingApprovedEmail(
  input: MeetingApprovedEmailInput
): { subject: string; html: string; text: string } {
  const subject = `Pick a time: meeting with ${input.requesterName}`
  const agendaHtml = input.agenda
    ? `<p style="margin:0 0 12px;color:#444"><strong>Agenda:</strong> ${input.agenda.replace(/</g, '&lt;')}</p>`
    : ''

  let timingHtml: string
  let timingText: string[]
  if (input.mode === 'day' && input.proposedDate) {
    const dateLabel = formatProposedDate(input.proposedDate)
    timingHtml =
      `<p style="margin:0 0 12px"><strong>Day:</strong> ${escape(dateLabel)} (${input.durationMin} min)</p>` +
      `<p style="margin:0 0 12px;color:#666">Open the dashboard to pick a time that works for you on that day.</p>`
    timingText = [`Day: ${dateLabel} (${input.durationMin} min)`]
  } else {
    const list = formatSlotList(
      input.slotIsos ?? [],
      input.durationMin,
      input.recipientTimezone
    )
    const slotsHtml = list
      .map(
        (s) =>
          `<li style="margin:4px 0;color:#333">${s.replace(/</g, '&lt;')}</li>`
      )
      .join('')
    timingHtml =
      `<p style="margin:0 0 6px"><strong>Pick one of these (${input.durationMin} min):</strong></p>` +
      `<ul style="margin:0 0 12px;padding-left:20px">${slotsHtml}</ul>`
    timingText = [
      `Pick a slot (${input.durationMin} min):`,
      ...list.map((s, i) => `${i + 1}. ${s}`)
    ]
  }

  const html = shell({
    preheader: `${input.requesterName} wants to meet - open to confirm`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.requesterName)}</strong> would like to meet with you. The request was approved.</p>` +
      `<p style="margin:0 0 12px"><strong>Title:</strong> ${escape(input.title)}</p>` +
      agendaHtml +
      timingHtml,
    ctaLabel: input.mode === 'day' ? 'Pick a time' : 'Pick a slot',
    ctaUrl: input.pickUrl,
    unsubscribeUrl: input.unsubscribeUrl
  })
  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.requesterName} would like to meet with you (approved).`,
    `Title: ${input.title}`,
    input.agenda ? `Agenda: ${input.agenda}` : '',
    '',
    ...timingText,
    '',
    `${input.mode === 'day' ? 'Pick a time' : 'Pick a slot'}: ${input.pickUrl}`,
    input.unsubscribeUrl ? `\nUnsubscribe: ${input.unsubscribeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export interface MeetingDeclinedEmailInput {
  recipientName: string
  declinerName: string
  title: string
  reason?: string | null
  reasonLabel: 'Declined' | 'Rejected'
  unsubscribeUrl?: string
}

export function meetingDeclinedOrRejectedEmail(
  input: MeetingDeclinedEmailInput
): { subject: string; html: string; text: string } {
  const subject = `${input.reasonLabel}: ${input.title}`
  const reasonHtml = input.reason
    ? `<p style="margin:0 0 12px;color:#444"><strong>Reason:</strong> ${input.reason.replace(/</g, '&lt;')}</p>`
    : ''
  const html = shell({
    preheader: `${input.declinerName} ${input.reasonLabel.toLowerCase()} the meeting`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.declinerName)}</strong> ${input.reasonLabel.toLowerCase()} your meeting request <em>${escape(input.title)}</em>.</p>` +
      reasonHtml,
    unsubscribeUrl: input.unsubscribeUrl
  })
  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.declinerName} ${input.reasonLabel.toLowerCase()} your meeting request "${input.title}".`,
    input.reason ? `Reason: ${input.reason}` : '',
    input.unsubscribeUrl ? `\nUnsubscribe: ${input.unsubscribeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export interface AssignmentEmailInput {
  recipientName: string
  assignerName: string
  taskRef: string
  taskTitle: string
  taskUrl: string
  unsubscribeUrl?: string
}

export function assignmentEmail(input: AssignmentEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Assigned to you: ${input.taskRef}`
  const html = shell({
    preheader: `${input.assignerName} assigned ${input.taskRef} to you - ${input.taskTitle}`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.assignerName)}</strong> assigned <a href="${escape(input.taskUrl)}" style="color:#0f766e">${escape(input.taskRef)} - ${escape(input.taskTitle)}</a> to you.</p>`,
    ctaLabel: 'Open task',
    ctaUrl: input.taskUrl,
    unsubscribeUrl: input.unsubscribeUrl
  })
  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.assignerName} assigned ${input.taskRef} - ${input.taskTitle} to you.`,
    '',
    `Open task: ${input.taskUrl}`,
    input.unsubscribeUrl ? `\nUnsubscribe: ${input.unsubscribeUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export interface InviteMemberEmailInput {
  recipientName: string
  inviterName: string
  companyName: string
  accessTier: 'admin' | 'lead' | 'member'
  loginEmail: string
  initialPassword: string
  acceptUrl: string
  expiresAt: string
}

export function inviteMemberEmail(input: InviteMemberEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `${input.inviterName} invited you to ${input.companyName}`
  const tierLabel = {
    admin: 'an admin',
    lead: 'a lead',
    member: 'a team member'
  }[input.accessTier]
  const expiresPretty = new Date(input.expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const credsHtml =
    `<div style="margin:12px 0;padding:14px 16px;border:1px solid #e4e4e7;border-radius:8px;background:#fafafa">` +
    `<p style="margin:0 0 6px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em">Your login</p>` +
    `<p style="margin:0 0 4px"><strong>Email:</strong> <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escape(input.loginEmail)}</code></p>` +
    `<p style="margin:0"><strong>Password:</strong> <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escape(input.initialPassword)}</code></p>` +
    `</div>`
  const html = shell({
    preheader: `${input.inviterName} invited you to join ${input.companyName} as ${tierLabel}`,
    bodyHtml:
      `<p style="margin:0 0 8px">Hi ${escape(input.recipientName.split(' ')[0] || input.recipientName)},</p>` +
      `<p style="margin:0 0 12px"><strong>${escape(input.inviterName)}</strong> invited you to join <strong>${escape(input.companyName)}</strong> on Backstage as ${escape(tierLabel)}.</p>` +
      credsHtml +
      `<p style="margin:0 0 12px;color:#444">Click below to accept the invite and sign in. You will be asked to change your password on first sign-in. The link expires on ${escape(expiresPretty)}.</p>`,
    ctaLabel: 'Accept invite',
    ctaUrl: input.acceptUrl
  })
  const text = [
    `Hi ${input.recipientName.split(' ')[0] || input.recipientName},`,
    '',
    `${input.inviterName} invited you to join ${input.companyName} on Backstage as ${tierLabel}.`,
    '',
    `Your login:`,
    `  Email: ${input.loginEmail}`,
    `  Password: ${input.initialPassword}`,
    '',
    `Accept here: ${input.acceptUrl}`,
    `You will be asked to change your password on first sign-in.`,
    `Link expires on ${expiresPretty}.`
  ].join('\n')
  return { subject, html, text }
}
