import { cn } from "@/lib/utils";

// PersonChip — the only way a person is shown.
// Avatar = initials in a 6px rounded square. Optional self-dot in red when
// the person is the viewer. Ported from design/ui.jsx.

type Size = "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { box: string; initials: string; name: string; gap: string }
> = {
  sm: { box: "h-5 w-5 text-[10px]", initials: "text-[10px]", name: "text-[13px]", gap: "gap-2" },
  md: { box: "h-6 w-6 text-[11px]", initials: "text-[11px]", name: "text-[13px]", gap: "gap-2" },
  lg: { box: "h-9 w-9 text-[14px]", initials: "text-sm", name: "text-[15px] font-medium", gap: "gap-2.5" },
};

export function PersonChip({
  name,
  initials,
  size = "sm",
  muted = false,
  self = false,
  nameOnly = false,
}: {
  name: string;
  /** Override the auto-derived initials. */
  initials?: string;
  size?: Size;
  muted?: boolean;
  self?: boolean;
  /** Skip rendering the name beside the chip. */
  nameOnly?: boolean;
}) {
  const derivedInitials =
    initials ??
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const dims = SIZES[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center", dims.gap)}>
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-md bg-muted font-medium tracking-wide text-muted-foreground",
          dims.box,
        )}
        aria-hidden
      >
        {derivedInitials}
        {self && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card"
            aria-hidden
          />
        )}
      </span>
      {!nameOnly && (
        <span
          className={cn(
            "truncate",
            muted ? "text-muted-foreground" : "text-foreground",
            dims.name,
          )}
        >
          {name}
        </span>
      )}
    </span>
  );
}
