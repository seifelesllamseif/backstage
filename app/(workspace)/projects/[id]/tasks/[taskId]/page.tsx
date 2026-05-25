import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { EditTaskForm } from "./edit-task-form";
import { HandoffSection } from "./handoff-section";

// Task editor with the seven-field handoff form. This is where the
// dashboard's handoff gate sends users when they try to move a task to
// Done without a complete handoff (see updateDashboardTaskStatus in
// /dashboard/actions.ts and decision 0022). Reverted from being a redirect
// (decision 0017 retired the standalone page assuming the slide-over had
// a handoff editor; the dashboard drawer doesn't yet — 3b polish folds
// this back in).

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
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Edit task</h1>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to board
        </Link>
      </header>

      <EditTaskForm task={task} assignees={assignees} projectId={projectId} />

      <HandoffSection taskId={task.id} handoff={task.handoff} />
    </main>
  );
}
