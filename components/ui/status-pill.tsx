import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/business-logic";

// StatusPill — fixed colors per task status. Ported from design/ui.jsx STATUS map.
// Uses the @theme tokens already wired in styles/globals.css.

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "text-muted-foreground bg-muted/40" },
  unscoped: { label: "Unscoped", className: "text-muted-foreground bg-muted/40" },
  todo: { label: "To do", className: "text-foreground/70 bg-muted/50" },
  in_progress: {
    label: "In progress",
    className: "text-info bg-info/15",
  },
  in_review: {
    label: "In review",
    className: "text-warning bg-warning/15",
  },
  done: {
    label: "Done",
    className: "text-success bg-success/15",
  },
  canceled: {
    label: "Canceled",
    className: "text-foreground/40 bg-muted/40 line-through",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

export function statusLabel(status: TaskStatus): string {
  return STATUS_STYLES[status].label;
}
