"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { HANDOFF_FIELDS } from "@/lib/handoff";

// Handoff CRUD server actions for slice 2. Authz: anyone signed-in in the
// same company (decision 0015). The handoff row is created lazily on first
// "Start handoff" click.

const HandoffStatusEnum = z.enum([
  "in_progress",
  "blocked",
  "ready_for_review",
  "done",
]);

export type HandoffActionState = { error: string } | { ok: true } | undefined;

export async function createHandoff(taskId: string): Promise<void> {
  const member = await getCurrentCrewMember();
  if (!member) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: member.companyId },
    select: { id: true, projectId: true },
  });
  if (!task) return;

  // Idempotent — task_id is unique on handoff, but check first so we don't
  // hit the unique-violation error path needlessly.
  const existing = await prisma.handoff.findUnique({
    where: { taskId: task.id },
    select: { id: true },
  });
  if (existing) {
    revalidatePath(`/projects/${task.projectId}/tasks/${task.id}`);
    return;
  }

  await prisma.handoff.create({
    data: {
      companyId: member.companyId,
      taskId: task.id,
      fromMemberId: member.id,
      status: "in_progress",
    },
  });

  revalidatePath(`/projects/${task.projectId}/tasks/${task.id}`);
}

export async function updateHandoff(
  _prev: HandoffActionState,
  formData: FormData,
): Promise<HandoffActionState> {
  const member = await getCurrentCrewMember();
  if (!member) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") ?? "");
  if (!z.uuid().safeParse(taskId).success) {
    return { error: "Bad task id." };
  }

  const statusRaw = String(formData.get("status") ?? "in_progress");
  const statusParsed = HandoffStatusEnum.safeParse(statusRaw);
  if (!statusParsed.success) return { error: "Bad status value." };

  // Collect the seven text fields. Trim and null-empty so isHandoffComplete
  // (which checks trim-length > 0) sees the same shape on read.
  const fieldValues: Record<string, string | null> = {};
  for (const f of HANDOFF_FIELDS) {
    const raw = String(formData.get(f) ?? "").trim();
    fieldValues[f] = raw === "" ? null : raw;
  }

  const handoff = await prisma.handoff.findFirst({
    where: { taskId, companyId: member.companyId },
    select: { id: true, taskId: true, task: { select: { projectId: true } } },
  });
  if (!handoff) {
    return {
      error: "No handoff for this task yet. Click 'Start handoff' first.",
    };
  }

  await prisma.handoff.update({
    where: { id: handoff.id },
    data: {
      status: statusParsed.data,
      ...fieldValues,
    },
  });

  revalidatePath(`/projects/${handoff.task.projectId}/tasks/${handoff.taskId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}
