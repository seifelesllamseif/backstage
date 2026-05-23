import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { boardColumns, type TaskStatus } from "@/lib/business-logic";
import { StatusPill } from "@/components/ui/status-pill";
import { PersonChip } from "@/components/ui/person-chip";
import { FilterChip } from "@/components/ui/filter-chip";
import { archiveProject } from "../actions";
import { StatusSelect } from "./status-select";
import { AddTaskForm } from "./add-task-form";
import { TaskPanel } from "./task-panel";

// Project board — slice-1/2 + slice-2-fidelity-pass restyled per decision 0017.
// Six columns, status-color pills, PersonChip on cards. ?task=<id> opens the
// right-side task panel; closing clears the param.

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { id: projectId } = await params;
  const { task: openTaskId } = await searchParams;

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

  // Resolve the panel data only when ?task= is present and points at a task
  // in this project + company.
  const panelTask = openTaskId
    ? await prisma.task.findFirst({
        where: {
          id: openTaskId,
          projectId: project.id,
          companyId: member.companyId,
        },
        include: {
          assignee: { select: { fullName: true, avatarInitials: true } },
          handoff: true,
        },
      })
    : null;

  const assignees = panelTask
    ? await prisma.crewMember.findMany({
        where: { companyId: member.companyId },
        select: { id: true, fullName: true, avatarInitials: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const today = startOfDay(new Date());
  const canArchive = member.accessTier === "admin" || member.accessTier === "lead";

  return (
    <div className="flex h-screen min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-divider px-6 py-4">
          <Link
            href="/projects"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Projects
          </Link>
          <span className="text-xs text-foreground/40">/</span>
          <h1 className="text-[15px] font-medium">{project.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {project.kind}
          </span>
          <span className="flex-1" />
          {canArchive && (
            <form action={archiveProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-destructive"
                title="Archive project"
              >
                Archive
              </button>
            </form>
          )}
        </header>

        <div className="flex items-center gap-2 border-b border-divider px-6 py-2.5">
          <FilterChip label="Assignee" value="Anyone" disabled />
          <FilterChip label="Due" value="Anytime" disabled />
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="px-6 py-3">
          <AddTaskForm projectId={project.id} />
        </div>

        <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-6">
          {boardColumns.map((status) => (
            <section key={status} className="flex w-64 shrink-0 flex-col gap-2.5">
              <header className="flex items-center gap-2 px-1">
                <StatusPill status={status} />
                <span className="text-[11px] tabular-nums text-foreground/40">
                  {tasksByColumn[status].length}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Add task to this column"
                  title="Use the form above to add a task"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </header>

              <ul className="flex flex-col gap-2">
                {tasksByColumn[status].length === 0 ? (
                  <li className="rounded-[10px] border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                    Nothing here.
                  </li>
                ) : (
                  tasksByColumn[status].map((task) => {
                    const isOverdue =
                      task.dueDate !== null &&
                      isBefore(task.dueDate, today) &&
                      task.status !== "done";
                    const isOpen = task.id === openTaskId;

                    return (
                      <li
                        key={task.id}
                        className={
                          isOpen
                            ? "relative flex flex-col gap-2 rounded-[10px] border border-foreground/30 bg-card p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                            : "relative flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3 hover:border-foreground/30"
                        }
                      >
                        <Link
                          href={`/projects/${project.id}?task=${task.id}`}
                          className="text-[13px] leading-snug hover:underline before:absolute before:inset-0"
                          scroll={false}
                        >
                          {task.title}
                        </Link>

                        <div className="relative z-10 flex items-center justify-between gap-2 text-[11px]">
                          <StatusSelect taskId={task.id} current={task.status} />

                          <div className="flex items-center gap-2">
                            {task.assignee ? (
                              <PersonChip
                                name={task.assignee.fullName}
                                initials={task.assignee.avatarInitials ?? undefined}
                                size="sm"
                                nameOnly
                              />
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] text-foreground/40">
                                —
                              </span>
                            )}
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
                              <span className="text-foreground/40">—</span>
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
      </div>

      {panelTask && (
        <TaskPanel
          task={{
            id: panelTask.id,
            projectId: panelTask.projectId,
            title: panelTask.title,
            description: panelTask.description,
            status: panelTask.status,
            assigneeId: panelTask.assigneeId,
            dueDate: panelTask.dueDate,
            assignee: panelTask.assignee,
          }}
          assignees={assignees}
          handoff={panelTask.handoff}
          projectId={project.id}
        />
      )}
    </div>
  );
}
