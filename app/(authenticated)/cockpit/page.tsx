import Link from "next/link";
import { format, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { StatusPill } from "@/components/ui/status-pill";
import { PersonChip } from "@/components/ui/person-chip";
import {
  countMissingFields,
  isHandoffComplete,
  HANDOFF_STATUS_LABELS,
} from "@/lib/handoff";

// Crew Cockpit, restyled per decision 0017. Slice-1/2 scope: header strip,
// my-tasks block, handoffs block (to-fill + received). Sidebar is up in
// the (authenticated) shell, so this page renders just the content column.

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

  const toFill = toFillRaw.filter((h) => !isHandoffComplete(h));
  const today = startOfDay(new Date());

  return (
    <main className="mx-auto flex max-w-[980px] flex-col gap-6 px-8 py-8">
      <header className="flex items-center justify-between gap-4 py-1">
        <PersonChip
          name={member.fullName}
          initials={member.avatarInitials ?? undefined}
          size="lg"
          self
        />
        <span className="text-xs text-muted-foreground">{member.accessTier}</span>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-baseline justify-between border-b border-divider px-5 py-3.5">
          <h2 className="text-base font-medium tracking-tight">My tasks</h2>
          <span className="text-xs text-muted-foreground">
            {tasks.length} open
          </span>
        </header>

        {tasks.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nothing on your plate. Open the board to pick up something or wait
            for a task to land here.
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {tasks.map((task) => {
              const isOverdue =
                task.dueDate !== null && isBefore(task.dueDate, today);
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/40"
                >
                  <StatusPill status={task.status} />
                  <Link
                    href={`/projects/${task.projectId}?task=${task.id}`}
                    className="flex-1 truncate hover:underline"
                    title={task.title}
                  >
                    {task.title}
                  </Link>
                  <Link
                    href={`/projects/${task.projectId}`}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  >
                    {task.project.name}
                  </Link>
                  {task.dueDate ? (
                    <span
                      className={
                        isOverdue
                          ? "w-14 text-right text-xs text-destructive"
                          : "w-14 text-right text-xs text-muted-foreground"
                      }
                    >
                      {format(task.dueDate, "MMM d")}
                    </span>
                  ) : (
                    <span className="w-14 text-right text-xs text-foreground/40">
                      —
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-baseline justify-between border-b border-divider px-5 py-3.5">
          <h2 className="text-base font-medium tracking-tight">Handoffs</h2>
          <span className="text-xs text-muted-foreground">
            {toFill.length} to fill · {received.length} received
          </span>
        </header>

        <div className="grid divide-x divide-divider sm:grid-cols-2">
          <div className="flex flex-col">
            <h3 className="px-5 pb-2 pt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
              To fill
            </h3>
            {toFill.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-muted-foreground">
                Nothing to fill.
              </p>
            ) : (
              <ul className="flex flex-col gap-px">
                {toFill.map((h) => {
                  const missing = countMissingFields(h);
                  return (
                    <li
                      key={h.id}
                      className="flex flex-col gap-1 px-5 py-2.5 hover:bg-muted/40"
                    >
                      <Link
                        href={`/projects/${h.task.projectId}?task=${h.task.id}`}
                        className="truncate text-sm hover:underline"
                        title={h.task.title}
                      >
                        {h.task.title}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                          {missing} field{missing === 1 ? "" : "s"} missing
                        </span>
                        <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-destructive">
                          Blocks Done
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col">
            <h3 className="px-5 pb-2 pt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
              Received
            </h3>
            {received.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-muted-foreground">
                Nothing received.
              </p>
            ) : (
              <ul className="flex flex-col gap-px">
                {received.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-1 px-5 py-2.5 hover:bg-muted/40"
                  >
                    <Link
                      href={`/projects/${h.task.projectId}?task=${h.task.id}`}
                      className="truncate text-sm hover:underline"
                      title={h.task.title}
                    >
                      {h.task.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {h.fromMember ? (
                        <PersonChip
                          name={h.fromMember.fullName}
                          initials={h.fromMember.avatarInitials ?? undefined}
                          size="sm"
                          muted
                        />
                      ) : (
                        <span>from unknown</span>
                      )}
                      <span>·</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5">
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
