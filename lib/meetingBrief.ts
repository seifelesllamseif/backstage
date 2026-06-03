// Pre-meeting brief fields. Mirror of lib/handoff.ts so the same UI
// pattern (progress chip, server-side completeness check, localStorage
// draft) can be reused for meeting requests.
//
// Three required, one optional. After the requestee accepts a slot,
// they can append `requesteeContext` on their side; that one is never
// required.

export const MEETING_BRIEF_FIELDS = [
  "goal",
  "context",
  "questions",
] as const;

export const MEETING_BRIEF_OPTIONAL_FIELDS = ["preRead"] as const;

export type MeetingBriefField = (typeof MEETING_BRIEF_FIELDS)[number];
export type MeetingBriefOptionalField =
  (typeof MEETING_BRIEF_OPTIONAL_FIELDS)[number];

export const MEETING_BRIEF_FIELD_LABELS: Record<
  MeetingBriefField | MeetingBriefOptionalField,
  string
> = {
  goal: "Goal",
  context: "Context",
  questions: "Questions",
  preRead: "Pre-read links",
};

export const MEETING_BRIEF_FIELD_HINTS: Record<
  MeetingBriefField | MeetingBriefOptionalField,
  string
> = {
  goal: "One line: what you want out of this meeting.",
  context: "Background the other side needs to walk into this.",
  questions: "Bulleted list of questions you want answered.",
  preRead: "Docs, PRs, designs the other side should skim first.",
};

export type MeetingBriefValues = {
  goal: string | null;
  context: string | null;
  questions: string | null;
  preRead: string | null;
};

export function isBriefComplete(
  b: MeetingBriefValues | null | undefined,
): boolean {
  if (!b) return false;
  return MEETING_BRIEF_FIELDS.every((f) => {
    const v = b[f];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function countMissingBriefFields(
  b: MeetingBriefValues | null | undefined,
): number {
  if (!b) return MEETING_BRIEF_FIELDS.length;
  return MEETING_BRIEF_FIELDS.filter((f) => {
    const v = b[f];
    return !(typeof v === "string" && v.trim().length > 0);
  }).length;
}

export function missingBriefFields(
  b: MeetingBriefValues | null | undefined,
): MeetingBriefField[] {
  if (!b) return [...MEETING_BRIEF_FIELDS];
  return MEETING_BRIEF_FIELDS.filter((f) => {
    const v = b[f];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}
