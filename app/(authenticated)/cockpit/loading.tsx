// Skeleton for /cockpit while the my-tasks + handoffs queries resolve.
// Matches the existing cockpit layout: header strip, my-tasks block,
// handoffs block. Pure CSS, no JS.

export default function CockpitLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <ul className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-14 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <ul className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
