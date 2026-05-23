"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import type { TaskStatus } from "@/lib/business-logic";
import type { HandoffFieldValues } from "@/lib/handoff";
import { StatusPill } from "@/components/ui/status-pill";
import { PersonChip } from "@/components/ui/person-chip";
import { IconButton } from "@/components/ui/icon-button";
import { EditTaskForm } from "./tasks/[taskId]/edit-task-form";
import { HandoffSection } from "./tasks/[taskId]/handoff-section";

// 480px right-side slide-over. Opens when the board's URL has ?task=<id>.
// Closing pushes back to the board (clears the search param). The actual
// form bodies (task fields + handoff section) are the same components that
// used to live on the standalone /tasks/[taskId] page — see decision 0017.

type Assignee = { id: string; fullName: string; avatarInitials: string | null };

type Handoff = (HandoffFieldValues & {
  id: string;
  status: "in_progress" | "blocked" | "ready_for_review" | "done";
}) | null;

type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  dueDate: Date | null;
  assignee: { fullName: string; avatarInitials: string | null } | null;
};

export function TaskPanel({
  task,
  assignees,
  handoff,
  projectId,
}: {
  task: Task;
  assignees: Assignee[];
  handoff: Handoff;
  projectId: string;
}) {
  const router = useRouter();
  const today = startOfDay(new Date());
  const overdue =
    task.dueDate !== null &&
    isBefore(task.dueDate, today) &&
    task.status !== "done" &&
    task.status !== "canceled";

  return (
    <aside className="flex w-[480px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-2.5 border-b border-divider px-5 py-3.5">
        <StatusPill status={task.status} />
        <span className="flex-1" />
        <IconButton label="Close panel" onClick={() => router.push(`/projects/${projectId}`)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="mb-2 text-[18px] font-medium leading-tight tracking-tight">
          {task.title}
        </h2>

        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <DetailField label="Assignee">
            {task.assignee ? (
              <PersonChip
                name={task.assignee.fullName}
                initials={task.assignee.avatarInitials ?? undefined}
                size="sm"
              />
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </DetailField>
          <DetailField label="Due">
            <span className={overdue ? "text-destructive" : "text-foreground"}>
              {task.dueDate ? format(task.dueDate, "MMM d") : "No date"}
            </span>
          </DetailField>
        </div>

        <div className="flex flex-col gap-6">
          <EditTaskForm task={task} assignees={assignees} projectId={projectId} />
          <HandoffSection taskId={task.id} handoff={handoff} />
        </div>
      </div>
    </aside>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}
