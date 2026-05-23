"use client";

import { useActionState, useRef, useEffect } from "react";
import { createProject, type CreateProjectState } from "./actions";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProject,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful submit (state goes back to undefined).
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
      <div className="flex items-stretch gap-2">
        <input
          name="name"
          type="text"
          placeholder="New project name"
          maxLength={80}
          required
          aria-label="Project name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          name="kind"
          defaultValue="standard"
          aria-label="Project kind"
          className="rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="standard">Standard</option>
          <option value="operations">Operations</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.fieldErrors?.name && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.name.join(" ")}
        </p>
      )}
    </form>
  );
}
