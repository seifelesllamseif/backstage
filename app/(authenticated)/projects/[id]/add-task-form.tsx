"use client";

import { useActionState, useRef, useEffect } from "react";
import { boardColumns } from "@/lib/business-logic";
import { createTask, type CreateTaskState } from "./actions";

const LABELS: Record<(typeof boardColumns)[number], string> = {
  backlog: "Backlog",
  unscoped: "Unscoped",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export function AddTaskForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<CreateTaskState, FormData>(
    createTask,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined && !pending) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex items-stretch gap-2">
        <input
          name="title"
          type="text"
          placeholder="New task title"
          maxLength={200}
          required
          aria-label="Task title"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          name="status"
          defaultValue="backlog"
          aria-label="Initial column"
          className="rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {boardColumns.map((status) => (
            <option key={status} value={status}>
              {LABELS[status]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
