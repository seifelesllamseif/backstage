"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { taskStatuses } from "@/lib/business-logic";
import { countMissingFields, isHandoffComplete } from "@/lib/handoff";

// Task CRUD server actions.
// Authz: any signed-in crew_member in the same company. Tier-gating lives on
// project create/archive (see ../actions.ts). The Done gate enforces that a
// task can't transition to status='done' without a complete handoff — see
// decision 0015.

export type CreateTaskState = { error: string } | undefined;

export type UpdateTaskState =
  | {
      error: string;
      reason?: "handoff-incomplete";
      missingCount?: number;
      taskUrl?: string;
    }
  | undefined;

export type StatusChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason: "handoff-incomplete" | "generic";
      message: string;
      missingCount?: number;
      taskUrl?: string;
    };

const TaskStatusEnum = z.enum(taskStatuses);

const CreateTaskSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1, { error: "Title is required." }).max(200),
  status: TaskStatusEnum.optional(),
});

const UpdateTaskSchema = z.object({
  taskId: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).optional().nullable(),
  status: TaskStatusEnum.optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
});

async function loadProjectInCompany(projectId: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, companyId: true },
  });
}

async function loadTaskWithHandoff(taskId: string, companyId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: {
      id: true,
      projectId: true,
      companyId: true,
      status: true,
      handoff: {
        select: {
          whatItIs: true,
          currentStatus: true,
          doneSoFar: true,
          stillLeft: true,
          fileLinks: true,
          gotchas: true,
          whoToAsk: true,
        },
      },
    },
  });
}

export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const member = await getCurrentCrewMember();
  if (!member) return { error: "Not signed in." };

  const parsed = CreateTaskSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) {
    return { error: "Couldn't create task — check the title." };
  }

  const project = await loadProjectInCompany(parsed.data.projectId, member.companyId);
  if (!project) return { error: "Project not found." };

  await prisma.task.create({
    data: {
      companyId: member.companyId,
      projectId: project.id,
      title: parsed.data.title,
      status: parsed.data.status ?? "backlog",
      createdBy: member.id,
    },
  });

  revalidatePath(`/projects/${project.id}`);
  return undefined;
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
): Promise<StatusChangeResult> {
  const member = await getCurrentCrewMember();
  if (!member) {
    return { ok: false, reason: "generic", message: "Not signed in." };
  }

  const parsed = TaskStatusEnum.safeParse(status);
  if (!parsed.success) {
    return { ok: false, reason: "generic", message: "Bad status value." };
  }

  const task = await loadTaskWithHandoff(taskId, member.companyId);
  if (!task) {
    return { ok: false, reason: "generic", message: "Task not found." };
  }

  if (parsed.data === "done" && task.status !== "done") {
    if (!isHandoffComplete(task.handoff)) {
      const missing = countMissingFields(task.handoff);
      return {
        ok: false,
        reason: "handoff-incomplete",
        message: task.handoff
          ? `Fill ${missing} more handoff field${missing === 1 ? "" : "s"} before moving to Done.`
          : "Start a handoff and fill all 7 fields before moving to Done.",
        missingCount: missing,
        taskUrl: `/projects/${task.projectId}/tasks/${task.id}`,
      };
    }
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: parsed.data },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function updateTask(
  _prev: UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const member = await getCurrentCrewMember();
  if (!member) return { error: "Not signed in." };

  const raw = {
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    status: formData.get("status") || undefined,
    assigneeId: formData.get("assigneeId") || null,
    dueDate: formData.get("dueDate") || null,
  };

  const parsed = UpdateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Couldn't save — check the inputs." };
  }

  const task = await loadTaskWithHandoff(parsed.data.taskId, member.companyId);
  if (!task) return { error: "Task not found." };

  // Done gate — same rule as updateTaskStatus.
  if (
    parsed.data.status === "done" &&
    task.status !== "done" &&
    !isHandoffComplete(task.handoff)
  ) {
    const missing = countMissingFields(task.handoff);
    return {
      error: task.handoff
        ? `Move to Done is blocked: fill ${missing} more handoff field${missing === 1 ? "" : "s"} below.`
        : "Move to Done is blocked: start a handoff below and fill all 7 fields first.",
      reason: "handoff-incomplete",
      missingCount: missing,
      taskUrl: `/projects/${task.projectId}/tasks/${task.id}`,
    };
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.assigneeId !== undefined && {
        assigneeId: parsed.data.assigneeId,
      }),
      ...(parsed.data.dueDate !== undefined && {
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      }),
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/projects/${task.projectId}/tasks/${task.id}`);
  revalidatePath("/cockpit");
  return undefined;
}
