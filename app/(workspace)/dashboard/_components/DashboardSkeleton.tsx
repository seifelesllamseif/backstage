// Skeleton that mimics the DashboardShell chrome (left rail, topbar, 6-column
// board strip) so the first paint is not a blank screen. Pure CSS, no JS.
// Used both as the route-segment loading.tsx and as the Suspense fallback in
// every dashboard page, per the Next.js 16 cacheComponents rule that
// uncached awaits must sit inside a Suspense boundary.

export default function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-black dark:text-white">
      <aside className="hidden w-[220px] shrink-0 flex-col gap-3 border-r border-zinc-200 p-3 md:flex dark:border-white/10">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.04]" />
        <div className="mt-2 flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-full animate-pulse rounded bg-zinc-100 dark:bg-white/[0.04]"
            />
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 dark:border-white/10">
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.04]" />
          <div className="flex-1" />
          <div className="h-7 w-40 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.04]" />
          <div className="h-7 w-7 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.04]" />
        </header>

        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {Array.from({ length: 6 }).map((_, colIdx) => (
            <section
              key={colIdx}
              className="flex w-[260px] shrink-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2 dark:border-white/10 dark:bg-black/40"
            >
              <div className="flex items-center justify-between px-1 py-1.5">
                <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
                <div className="h-3.5 w-6 animate-pulse rounded bg-zinc-200 dark:bg-white/10" />
              </div>
              {Array.from({
                length: colIdx === 0 ? 4 : colIdx === 2 ? 3 : 2
              }).map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-12 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
                    <div className="h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
                  </div>
                  <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
                  <div className="mt-1 flex items-center justify-between">
                    <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
                    <div className="size-5 animate-pulse rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
