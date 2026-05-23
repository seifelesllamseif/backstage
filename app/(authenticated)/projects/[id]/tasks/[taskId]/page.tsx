import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { EditTaskForm } from "./edit-task-form";
import { HandoffSection } from "./handoff-section";

// Slice-1 step 5 + slice-2 handoff section. Plain server-rendered forms for
// now; UI polish + detail-panel design fidelity lands in a later pass per
// decisions 0013 and 0015.

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = await params;

  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId,
      companyId: member.companyId,
    },
    include: {
      handoff: true,
    },
  });
  if (!task) {
    notFound();
  }

  const assignees = await prisma.crewMember.findMany({
    where: { companyId: member.companyId },
    select: { id: true, fullName: true, avatarInitials: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-medium">Edit task</h1>
        <p className="text-sm text-muted-foreground">
          Plain editor for slice 1. Detail panel UI lands in a later pass.
        </p>
      </header>

      <EditTaskForm task={task} assignees={assignees} projectId={projectId} />

      <HandoffSection taskId={task.id} handoff={task.handoff} />
    </main>
  );
}
