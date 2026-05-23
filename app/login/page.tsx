import { LoginForm } from "./login-form";

// Server component shell so we can read searchParams cleanly and pass the
// redirect target as a prop, rather than juggling useSearchParams + Suspense
// on the client.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">Backstage</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue.</p>
      </header>

      <LoginForm redirectTo={redirectTo ?? ""} />
    </main>
  );
}
