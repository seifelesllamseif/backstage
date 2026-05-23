"use client";

import { useActionState, useState, useTransition } from "react";
import {
  HANDOFF_FIELDS,
  HANDOFF_FIELD_HINTS,
  HANDOFF_FIELD_LABELS,
  HANDOFF_STATUS_LABELS,
  countMissingFields,
  isHandoffComplete,
  type HandoffFieldValues,
} from "@/lib/handoff";
import {
  createHandoff,
  updateHandoff,
  type HandoffActionState,
} from "./handoff-actions";

type HandoffStatus = keyof typeof HANDOFF_STATUS_LABELS;

type HandoffRow = HandoffFieldValues & { id: string; status: HandoffStatus };

type Props = {
  taskId: string;
  handoff: HandoffRow | null;
};

export function HandoffSection({ taskId, handoff }: Props) {
  if (!handoff) {
    return <StartHandoffButton taskId={taskId} />;
  }
  return <HandoffView taskId={taskId} handoff={handoff} />;
}

function StartHandoffButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header>
        <h2 className="text-sm font-medium">Handoff</h2>
        <p className="text-xs text-muted-foreground">
          No handoff started yet. Fill the seven fields below when this task is
          finishing — the next person picks it up cleanly.
        </p>
      </header>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => createHandoff(taskId))}
        className="self-start rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start handoff"}
      </button>
    </section>
  );
}

function HandoffView({
  taskId,
  handoff,
}: {
  taskId: string;
  handoff: HandoffRow;
}) {
  const complete = isHandoffComplete(handoff);
  // Default to read-only when complete, edit when incomplete. The Edit button
  // on the read-only view flips back.
  const [editing, setEditing] = useState(!complete);

  if (complete && !editing) {
    return (
      <HandoffReadOnly handoff={handoff} onEdit={() => setEditing(true)} />
    );
  }

  return (
    <HandoffForm
      taskId={taskId}
      handoff={handoff}
      onSaved={() => {
        if (complete) setEditing(false);
      }}
    />
  );
}

function HandoffReadOnly({
  handoff,
  onEdit,
}: {
  handoff: HandoffRow;
  onEdit: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Handoff</h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-muted px-2 py-0.5 text-success">
            Complete
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {HANDOFF_STATUS_LABELS[handoff.status]}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        </div>
      </header>

      <dl className="flex flex-col gap-3 text-sm">
        {HANDOFF_FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {HANDOFF_FIELD_LABELS[field]}
            </dt>
            <dd className="whitespace-pre-wrap">{handoff[field]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HandoffForm({
  taskId,
  handoff,
  onSaved,
}: {
  taskId: string;
  handoff: HandoffRow;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<HandoffActionState, FormData>(
    async (prev, formData) => {
      const result = await updateHandoff(prev, formData);
      if (result && "ok" in result && result.ok) {
        onSaved();
      }
      return result;
    },
    undefined,
  );

  const missing = countMissingFields(handoff);
  const complete = missing === 0;

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-md border border-border bg-card p-4"
    >
      <input type="hidden" name="taskId" value={taskId} />

      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Handoff</h2>
        <span
          className={
            complete
              ? "rounded-full bg-muted px-2 py-0.5 text-[11px] text-success"
              : "rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
          }
        >
          {complete
            ? "Complete"
            : `${missing} field${missing === 1 ? "" : "s"} missing`}
        </span>
      </header>

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Status</span>
        <select
          name="status"
          defaultValue={handoff.status}
          className="rounded-md border border-border bg-background px-2 py-2 text-sm"
        >
          {(
            Object.entries(HANDOFF_STATUS_LABELS) as [HandoffStatus, string][]
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {HANDOFF_FIELDS.map((field) => (
        <label key={field} className="flex flex-col gap-1.5 text-sm">
          <span className="flex items-baseline justify-between gap-2">
            <span>{HANDOFF_FIELD_LABELS[field]}</span>
            <span className="text-xs text-muted-foreground">
              {HANDOFF_FIELD_HINTS[field]}
            </span>
          </span>
          <textarea
            name={field}
            defaultValue={handoff[field] ?? ""}
            rows={field === "whatItIs" || field === "doneSoFar" ? 3 : 2}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      ))}

      {state && "error" in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save handoff"}
      </button>
    </form>
  );
}
