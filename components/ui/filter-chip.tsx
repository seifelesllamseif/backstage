import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// FilterChip — board toolbar dropdown trigger. Ported from design/ui.jsx
// FilterChip pattern. Used as a button or a label; the dropdown menu itself
// is up to the caller. For slice 2 fidelity pass we render it as static
// non-interactive labels (filtering ships later).

export function FilterChip({
  label,
  value,
  disabled = false,
  onClick,
  className,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs",
        "text-muted-foreground hover:text-foreground",
        "disabled:cursor-default disabled:hover:text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
      <ChevronDown className="h-3 w-3" aria-hidden />
    </button>
  );
}
