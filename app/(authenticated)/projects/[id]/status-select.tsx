"use client";

import { useTransition } from "react";
import { taskStatuses, type TaskStatus } from "@/lib/business-logic";
import { updateTaskStatus } from "./actions";

const LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  unscoped: "Unscoped",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  canceled: "Canceled",
};

export function StatusSelect({
  taskId,
  current,
}: {
  taskId: string;
  current: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={current}
      disabled={pending}
      aria-label="Status"
      className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] disabled:opacity-50"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await updateTaskStatus(taskId, next);
        });
      }}
    >
      {taskStatuses.map((status) => (
        <option key={status} value={status}>
          {LABELS[status]}
        </option>
      ))}
    </select>
  );
}
