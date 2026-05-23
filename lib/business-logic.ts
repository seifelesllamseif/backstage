/**
 * Backstage business rules in code.
 *
 * The "why" for each value lives in docs/decisions/. This file is the
 * runtime source of truth — if a Tailwind class, a Prisma enum, or a
 * docs file disagrees with what's here, this file wins and the other
 * one is the bug.
 */

/** SKAM dark theme. Source: docs/backstage-os-slice-1-plan.md §10. */
export const skamTheme = {
  page: "#0E0E10",
  card: "#161618",
  cardRaised: "#1A1A1C",
  border: "#2A2A2E",
  divider: "#232327",
  textPrimary: "#F2F2F0",
  textSecondary: "#A8A8AE",
  textMuted: "#8A8A90",
  textDim: "#5C5C62",
  accent: "#E24B4A",
  success: "#5DCAA5",
  warning: "#EF9F27",
  info: "#85B7EB",
  radiusCard: 12,
  radiusInner: 8,
} as const;

/**
 * Red is for attention only — overdue dates, the person's identity.
 * Never a default fill. If red is everywhere it stops meaning "look here".
 */
export const redIsForAttentionOnly = true;

/** Task workflow. The six-column board renders the first six in order; `canceled` is a side-state. */
export const taskStatuses = [
  "backlog",
  "unscoped",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

/** Columns shown on the project board, in left-to-right order. Excludes `canceled`. */
export const boardColumns = taskStatuses.slice(0, 6) as readonly Exclude<TaskStatus, "canceled">[];

/** Access tiers. Titles are free-text and live in `crew_member.title`; this controls what you can DO. */
export const accessTiers = ["admin", "lead", "member"] as const;
export type AccessTier = (typeof accessTiers)[number];

/** Project kinds. `operations` is the standing lane for non-project work (onboarding, recruiting, the Vault). */
export const projectKinds = ["standard", "operations"] as const;
export type ProjectKind = (typeof projectKinds)[number];

/** Name of the standing operations project that every company gets seeded with. */
export const operationsProjectName = "Operations";
