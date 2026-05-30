// Source of truth for runtime business rules. If a Tailwind class, a Prisma
// enum, or a docs file disagrees with what's here, this file wins.

export const verbivoreTheme = {
  page: '#0E1414',
  card: '#1A2424',
  cardRaised: '#22302F',
  border: 'rgba(237, 232, 220, 0.08)',
  divider: 'rgba(237, 232, 220, 0.05)',
  textPrimary: '#EDE8DC',
  textSecondary: '#B5C0C0',
  textMuted: '#7A8B8B',
  textDim: '#566868',
  accent: '#00A89E',
  success: '#5DCAA5',
  warning: '#EF9F27',
  info: '#85B7EB',
  radiusCard: 8,
  radiusInner: 6
} as const

// Red is reserved for attention (overdue dates, identity). If it's everywhere
// it stops meaning "look here".
export const redIsForAttentionOnly = true

export const taskStatuses = [
  'backlog',
  'unscoped',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
  'duplicate'
] as const
export type TaskStatus = (typeof taskStatuses)[number]

// First six render as columns; canceled and duplicate are side-states.
export const boardColumns = taskStatuses.slice(0, 6) as readonly Exclude<
  TaskStatus,
  'canceled' | 'duplicate'
>[]

// Titles are free text and display-only; access_tier controls what a member
// can DO.
export const accessTiers = ['admin', 'lead', 'member'] as const
export type AccessTier = (typeof accessTiers)[number]

// `operations` is the standing lane for non-project work (onboarding,
// recruiting, the Vault).
export const projectKinds = ['standard', 'operations'] as const
export type ProjectKind = (typeof projectKinds)[number]

export const operationsProjectName = 'Operations'
