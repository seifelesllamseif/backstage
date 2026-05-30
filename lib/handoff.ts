export const HANDOFF_FIELDS = [
  "whatItIs",
  "currentStatus",
  "doneSoFar",
  "stillLeft",
  "fileLinks",
  "gotchas",
  "whoToAsk",
] as const;

export type HandoffField = (typeof HANDOFF_FIELDS)[number];

export const HANDOFF_FIELD_LABELS: Record<HandoffField, string> = {
  whatItIs: "What it is",
  currentStatus: "Current status",
  doneSoFar: "Done so far",
  stillLeft: "Still left",
  fileLinks: "Where the files are",
  gotchas: "Gotchas",
  whoToAsk: "Who to ask",
};

export const HANDOFF_FIELD_HINTS: Record<HandoffField, string> = {
  whatItIs: "One or two lines: what the task is and why.",
  currentStatus: "Where it stands now.",
  doneSoFar: "What is finished.",
  stillLeft: "What remains.",
  fileLinks: "Exact links or paths.",
  gotchas: "Anything non-obvious that would waste the next person's time.",
  whoToAsk: "One or two people who can unblock it.",
};

export const HANDOFF_STATUS_LABELS = {
  in_progress: "In progress",
  blocked: "Blocked",
  ready_for_review: "Ready for review",
  done: "Done",
} as const;

export type HandoffFieldValues = {
  [K in HandoffField]: string | null;
};

export function isHandoffComplete(h: HandoffFieldValues | null | undefined): boolean {
  if (!h) return false;
  return HANDOFF_FIELDS.every((f) => {
    const v = h[f];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function countMissingFields(
  h: HandoffFieldValues | null | undefined,
): number {
  if (!h) return HANDOFF_FIELDS.length;
  return HANDOFF_FIELDS.filter((f) => {
    const v = h[f];
    return !(typeof v === "string" && v.trim().length > 0);
  }).length;
}
