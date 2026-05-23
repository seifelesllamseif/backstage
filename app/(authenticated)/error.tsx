"use client";

// Slice-1 step 7: friendly error fallback for any (authenticated) route.
// Per plan §7: "plain language and a retry. Never a raw error string."
// The actual error.message is sent to console for debugging, not to the user.

import { useEffect } from "react";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[authenticated/error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium">Something didn&rsquo;t load.</h1>
      <p className="text-sm text-muted-foreground">
        Give it a second and try again. If it keeps failing, sign out and back
        in.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
