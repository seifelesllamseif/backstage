// Slice-1 step 7: generic skeleton for any (authenticated) route that suspends.
// Per-route skeletons can replace this when the UI-heavy fidelity pass lands.

export default function AuthenticatedLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 animate-pulse rounded-full bg-muted"
            aria-hidden
          />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
      </header>

      <div className="h-4 w-24 animate-pulse rounded bg-muted" />

      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-12 animate-pulse rounded-md border border-border bg-card"
          />
        ))}
      </ul>
    </main>
  );
}
