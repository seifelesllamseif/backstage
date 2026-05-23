import Link from "next/link";
import { format, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { signOut } from "@/app/login/actions";
import type { TaskStatus } from "@/lib/business-logic";
import {
  countMissingFields,
  isHandoffComplete,
  HANDOFF_STATUS_LABELS,
} from "@/lib/handoff";

// Slice-1 step 6 + slice-2 §6.3: Crew Cockpit. Three blocks:
//   1. Header strip
//   2. My tasks (slice 1)
//   3. Handoffs — to fill + received (slice 2)
// Onboarding / allocation / roadmap are later slices.

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

  const [tasks, toFillRaw, received] = await Promise.all([
    prisma.task.findMany({
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
    }),
    prisma.handoff.findMany({
      where: {
        companyId: member.companyId,
        task: {
          assigneeId: member.id,
          status: { notIn: ["done", "canceled"] },
        },
      },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.handoff.findMany({
      where: {
        companyId: member.companyId,
        toMemberId: member.id,
      },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        fromMember: { select: { fullName: true, avatarInitials: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // To-fill is the subset of my-task handoffs that are incomplete.
  const toFill = toFillRaw.filter((h) => !isHandoffComplete(h));

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
                  ? STATUS_LABELS[task.status as keyof typeof STATUS_LABELS]
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

      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Handoffs</h2>
          <span className="text-xs text-muted-foreground">
            {toFill.length} to fill · {received.length} received
          </span>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              To fill
            </h3>
            {toFill.length === 0 ? (
              <p className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
                Nothing to fill.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {toFill.map((h) => {
                  const missing = countMissingFields(h);
                  return (
                    <li
                      key={h.id}
                      className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm"
                    >
                      <Link
                        href={`/projects/${h.task.projectId}/tasks/${h.task.id}`}
                        className="truncate hover:underline"
                        title={h.task.title}
                      >
                        {h.task.title}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {missing} field{missing === 1 ? "" : "s"} missing
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-destructive">
                          Blocks Done
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              Received
            </h3>
            {received.length === 0 ? (
              <p className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
                Nothing received.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {received.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <Link
                      href={`/projects/${h.task.projectId}/tasks/${h.task.id}`}
                      className="truncate hover:underline"
                      title={h.task.title}
                    >
                      {h.task.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        from {h.fromMember?.fullName ?? "unknown"}
                      </span>
                      <span>·</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {HANDOFF_STATUS_LABELS[h.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
