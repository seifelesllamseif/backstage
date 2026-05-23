import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { boardColumns, type TaskStatus } from "@/lib/business-logic";
import { archiveProject } from "../actions";
import { StatusSelect } from "./status-select";
import { AddTaskForm } from "./add-task-form";

// Slice-1 steps 4 + 5: read-only board layout from step 4, plus inline
// create + status-change + edit links from step 5. canceled tasks are
// hidden — see decision 0012. CRUD-first / minimal UI per decision 0013.

const COLUMN_LABELS: Record<Exclude<TaskStatus, "canceled">, string> = {
  backlog: "Backlog",
  unscoped: "Unscoped",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: member.companyId },
  });
  if (!project) {
    notFound();
  }

  const tasks = await prisma.task.findMany({
    where: {
      companyId: member.companyId,
      projectId: project.id,
      status: { not: "canceled" },
    },
    include: {
      assignee: { select: { id: true, fullName: true, avatarInitials: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const tasksByColumn = Object.fromEntries(
    boardColumns.map((status) => [status, [] as typeof tasks]),
  ) as Record<Exclude<TaskStatus, "canceled">, typeof tasks>;
  for (const task of tasks) {
    if (task.status !== "canceled") {
      tasksByColumn[task.status].push(task);
    }
  }

  const today = startOfDay(new Date());
  const canArchive = member.accessTier === "admin" || member.accessTier === "lead";

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-medium">{project.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {project.kind}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {canArchive && (
            <form action={archiveProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="text-muted-foreground hover:text-destructive"
                title="Archive project"
              >
                Archive
              </button>
            </form>
          )}
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground"
          >
            ← Projects
          </Link>
        </div>
      </header>

      <AddTaskForm projectId={project.id} />

      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2">
        {boardColumns.map((status) => (
          <section
            key={status}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-md border border-border bg-card p-3"
          >
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">{COLUMN_LABELS[status]}</h2>
              <span className="text-xs text-muted-foreground">
                {tasksByColumn[status].length}
              </span>
            </header>

            <ul className="flex flex-col gap-2">
              {tasksByColumn[status].length === 0 ? (
                <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Nothing here.
                </li>
              ) : (
                tasksByColumn[status].map((task) => {
                  const isOverdue =
                    task.dueDate !== null &&
                    isBefore(task.dueDate, today) &&
                    task.status !== "done";

                  return (
                    <li
                      key={task.id}
                      className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
                    >
                      <Link
                        href={`/projects/${project.id}/tasks/${task.id}`}
                        className="text-sm leading-snug hover:underline"
                      >
                        {task.title}
                      </Link>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <StatusSelect taskId={task.id} current={task.status} />

                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                            title={task.assignee?.fullName ?? "Unassigned"}
                          >
                            {task.assignee?.avatarInitials ?? "—"}
                          </span>
                          {task.dueDate ? (
                            <span
                              className={
                                isOverdue
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              {format(task.dueDate, "MMM d")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No due</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
