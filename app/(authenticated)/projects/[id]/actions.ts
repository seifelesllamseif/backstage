"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { taskStatuses } from "@/lib/business-logic";

// Task CRUD server actions for slice 1 step 5.
// Authz: any signed-in crew_member in the same company. Tier-gating is for
// project archive (see ../actions.ts) and project create. See decision 0013.

export type CreateTaskState = { error: string } | undefined;
export type UpdateTaskState = { error: string } | undefined;

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

async function loadTaskInCompany(taskId: string, companyId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: { id: true, projectId: true, companyId: true },
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

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const member = await getCurrentCrewMember();
  if (!member) return;

  const parsed = TaskStatusEnum.safeParse(status);
  if (!parsed.success) return;

  const task = await loadTaskInCompany(taskId, member.companyId);
  if (!task) return;

  await prisma.task.update({
    where: { id: task.id },
    data: { status: parsed.data },
  });

  revalidatePath(`/projects/${task.projectId}`);
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

  const task = await loadTaskInCompany(parsed.data.taskId, member.companyId);
  if (!task) return { error: "Task not found." };

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
  return undefined;
}
