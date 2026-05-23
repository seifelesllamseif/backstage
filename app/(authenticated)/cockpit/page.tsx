import Link from "next/link";
import { format, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { signOut } from "@/app/login/actions";
import type { TaskStatus } from "@/lib/business-logic";

// Slice-1 step 6: the Crew Cockpit, cut down per plan §5.2.
// Two blocks only: header strip and my-tasks. Onboarding / allocation /
// handoffs / roadmap are later slices and render nothing here.

const STATUS_LABELS: Record<Exclude<TaskStatus, "canceled" | "done">, string> = {
  backlog: "Backlog",
  unscoped: "Unscoped",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
};

export default async function CockpitPage() {
  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const tasks = await prisma.task.findMany({
    where: {
      companyId: member.companyId,
      assigneeId: member.id,
      status: { notIn: ["done", "canceled"] },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: [
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  const today = startOfDay(new Date());

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
            aria-hidden
          >
            {member.avatarInitials ?? "—"}
          </span>
          <div>
            <h1 className="text-lg font-medium">{member.fullName}</h1>
            <p className="text-xs text-muted-foreground">{member.accessTier}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground"
          >
            Projects
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">My tasks</h2>
          <span className="text-xs text-muted-foreground">
            {tasks.length} open
          </span>
        </header>

        {tasks.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            Nothing on your plate. Open the board to pick up something or wait
            for a task to land here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => {
              const isOverdue =
                task.dueDate !== null && isBefore(task.dueDate, today);
              const statusLabel =
                task.status in STATUS_LABELS
                  ? STATUS_LABELS[
                      task.status as keyof typeof STATUS_LABELS
                    ]
                  : task.status;

              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-sm"
                >
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {statusLabel}
                  </span>

                  <Link
                    href={`/projects/${task.projectId}/tasks/${task.id}`}
                    className="flex-1 truncate hover:underline"
                    title={task.title}
                  >
                    {task.title}
                  </Link>

                  <Link
                    href={`/projects/${task.projectId}`}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    title="View board"
                  >
                    {task.project.name}
                  </Link>

                  {task.dueDate ? (
                    <span
                      className={
                        isOverdue
                          ? "text-xs text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {format(task.dueDate, "MMM d")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
