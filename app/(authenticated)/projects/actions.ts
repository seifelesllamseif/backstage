"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAccessTier } from "@/lib/dal";

// Server actions for the projects step.
// Authorization: admin + lead only — see decisions 0011 and 0013.

export type CreateProjectState =
  | { error: string; fieldErrors?: Record<string, string[]> }
  | undefined;

const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(80, { error: "Name must be at most 80 characters." }),
  kind: z.enum(["standard", "operations"]),
});

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = CreateProjectSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "standard",
  });

  if (!parsed.success) {
    return {
      error: "Please fix the fields below.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    await prisma.project.create({
      data: {
        companyId: member.companyId,
        name: parsed.data.name,
        kind: parsed.data.kind,
      },
    });
  } catch (e) {
    // Most likely cause: unique constraint (companyId, name) collision.
    const message =
      e instanceof Error && "code" in e && e.code === "P2002"
        ? "A project with that name already exists."
        : "Couldn't create the project. Try again.";
    return { error: message };
  }

  revalidatePath("/projects");
  return undefined;
}

const ArchiveProjectSchema = z.object({ projectId: z.uuid() });

export async function archiveProject(formData: FormData): Promise<void> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = ArchiveProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return;

  // Update only if the project is in the caller's company. updateMany with a
  // companyId filter is the safe pattern — update would throw if the row
  // isn't found, leaking existence of cross-company rows.
  await prisma.project.updateMany({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    data: { isArchived: true },
  });

  revalidatePath("/projects");
  redirect("/projects");
}

const RenameProjectSchema = z.object({
  projectId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(80, { error: "Name must be at most 80 characters." }),
});

export type RenameProjectState =
  | { error: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function renameProject(
  formData: FormData,
): Promise<RenameProjectState> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = RenameProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      error: "Invalid input.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    await prisma.project.updateMany({
      where: { id: parsed.data.projectId, companyId: member.companyId },
      data: { name: parsed.data.name },
    });
  } catch (e) {
    const message =
      e instanceof Error && "code" in e && e.code === "P2002"
        ? "A project with that name already exists."
        : "Couldn't rename the project. Try again.";
    return { error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return undefined;
}

export async function unarchiveProject(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = ArchiveProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return { error: "Invalid project id." };

  await prisma.project.updateMany({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    data: { isArchived: false },
  });

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return undefined;
}

// Archive variant that doesn't redirect — used from the in-dashboard panel.
export async function archiveProjectInPlace(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = ArchiveProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return { error: "Invalid project id." };

  await prisma.project.updateMany({
    where: { id: parsed.data.projectId, companyId: member.companyId },
    data: { isArchived: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return undefined;
}

// Create variant for the in-dashboard panel — returns success/error without
// the form-state shape used by useActionState in the standalone page.
export async function createProjectInPlace(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const member = await requireAccessTier(["admin", "lead"]);

  const parsed = CreateProjectSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "standard",
  });

  if (!parsed.success) {
    return { error: "Please enter a valid name (2–80 chars)." };
  }

  try {
    await prisma.project.create({
      data: {
        companyId: member.companyId,
        name: parsed.data.name,
        kind: parsed.data.kind,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error && "code" in e && e.code === "P2002"
        ? "A project with that name already exists."
        : "Couldn't create the project. Try again.";
    return { error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return undefined;
}
