"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { taskStatuses, type TaskStatus } from "@/lib/business-logic";
import { updateTaskStatus, type StatusChangeResult } from "./actions";

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
  const [error, setError] = useState<{
    message: string;
    taskUrl?: string;
  } | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <select
        ref={selectRef}
        defaultValue={current}
        disabled={pending}
        aria-label="Status"
        className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] disabled:opacity-50"
        onChange={(e) => {
          const next = e.target.value;
          setError(null);
          startTransition(async () => {
            const result: StatusChangeResult = await updateTaskStatus(
              taskId,
              next,
            );
            if (!result.ok) {
              // Revert the visible select to the actual stored status.
              if (selectRef.current) selectRef.current.value = current;
              setError({
                message: result.message,
                taskUrl:
                  result.reason === "handoff-incomplete"
                    ? result.taskUrl
                    : undefined,
              });
            }
            // On success: revalidatePath causes the parent to re-render with
            // the new status, which becomes the new `current`.
          });
        }}
      >
        {taskStatuses.map((status) => (
          <option key={status} value={status}>
            {LABELS[status]}
          </option>
        ))}
      </select>

      {error && (
        <div className="flex flex-col gap-0.5 text-[11px] text-destructive">
          <span>{error.message}</span>
          {error.taskUrl && (
            <Link
              href={error.taskUrl}
              className="underline hover:no-underline"
            >
              Fill handoff →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
