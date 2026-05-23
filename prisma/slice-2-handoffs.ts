// Slice-2 handoff sample data + idempotent seeder.
// Used by both prisma/seed.ts (fresh seed) and
// prisma/scripts/seed-slice-2-handoffs.ts (patch an existing seeded DB).
// See docs/decisions/0015-slice-2-handoff-architecture.md.

import type { PrismaClient } from "@prisma/client";

type HandoffStatus = "in_progress" | "blocked" | "ready_for_review" | "done";

type Sample = {
  taskTitle: string;
  status: HandoffStatus;
  whatItIs?: string;
  currentStatus?: string;
  doneSoFar?: string;
  stillLeft?: string;
  fileLinks?: string;
  gotchas?: string;
  whoToAsk?: string;
};

export const HANDOFF_SAMPLES: readonly Sample[] = [
  {
    taskTitle: "Write episode 1 outline",
    status: "done",
    whatItIs:
      "Outline for episode 1 — structure, beats, and the cold-open scene we landed on with Tariq.",
    currentStatus:
      "Outline locked. Sent to Tariq for sign-off; sign-off came back yes.",
    doneSoFar:
      "Three-act outline finished, beats numbered, cold-open scenario chosen and approved.",
    stillLeft:
      "Nothing on this task; the next step lives in 'Lock script for ep 1'.",
    fileLinks: "Drive: SKAM > Pilot > Outlines > ep1-outline-v3.docx",
    gotchas:
      "Watch the act-2 transition — casting choice for Lead changes the pacing there. Re-check after casting locks.",
    whoToAsk:
      "Tariq for story decisions; Karim (me) for outline details until handover.",
  },
  {
    taskTitle: "Set up shared Drive structure",
    status: "done",
    whatItIs:
      "Top-level Drive folder structure for the company: Pilot Episode, Operations, Vault, archived.",
    currentStatus:
      "Structure created and shared with the team; permissions reviewed.",
    doneSoFar:
      "Folders created, naming convention documented, everyone added with edit / view as appropriate.",
    stillLeft:
      "Nothing immediate. Add subfolders per project as they spin up.",
    fileLinks: "Drive root: drive.google.com/drive/folders/<id-stub>",
    gotchas:
      "Don't move the Operations folder — its link is referenced from the onboarding doc and a couple of pinned Slack threads.",
    whoToAsk: "Iman for permissions; Tariq for naming convention questions.",
  },
  {
    taskTitle: "Storyboard cold open",
    status: "in_progress",
    whatItIs:
      "Storyboard for the cold open of ep 1 — 8–10 panels showing the diner scene from the outline.",
    currentStatus:
      "Half rough panels done. Pacing feels off; need to redo panels 4–6 once the script locks.",
    doneSoFar:
      "Panels 1–3 cleaned up; rough sketches for 7–10; reference board done.",
    // stillLeft, fileLinks, gotchas, whoToAsk intentionally null — partial handoff.
  },
  {
    taskTitle: "Lock script for ep 1",
    status: "ready_for_review",
    whatItIs:
      "Lock the script for ep 1 — outline is approved, draft is in revision.",
    currentStatus:
      "Second pass done; waiting on Tariq's feedback on the act-3 ending.",
    doneSoFar:
      "First draft, table read, second draft with notes incorporated, locations confirmed with Tariq.",
    stillLeft:
      "Tariq's act-3 notes, one more polish pass, hand to production.",
    fileLinks: "Drive: SKAM > Pilot > Scripts > ep1-draft-v2.fdx",
    // gotchas, whoToAsk intentionally null — partial handoff.
  },
];

export async function seedSlice2Handoffs(
  prisma: PrismaClient,
  companyId: string,
): Promise<{ inserted: number; skipped: number; missing: number }> {
  let inserted = 0;
  let skipped = 0;
  let missing = 0;

  for (const sample of HANDOFF_SAMPLES) {
    const task = await prisma.task.findFirst({
      where: { companyId, title: sample.taskTitle },
      select: { id: true },
    });
    if (!task) {
      missing += 1;
      continue;
    }
    const existing = await prisma.handoff.findUnique({
      where: { taskId: task.id },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.handoff.create({
      data: {
        companyId,
        taskId: task.id,
        status: sample.status,
        whatItIs: sample.whatItIs ?? null,
        currentStatus: sample.currentStatus ?? null,
        doneSoFar: sample.doneSoFar ?? null,
        stillLeft: sample.stillLeft ?? null,
        fileLinks: sample.fileLinks ?? null,
        gotchas: sample.gotchas ?? null,
        whoToAsk: sample.whoToAsk ?? null,
      },
    });
    inserted += 1;
  }

  return { inserted, skipped, missing };
}
