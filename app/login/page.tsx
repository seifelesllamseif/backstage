import { LoginForm } from '@/components/login-form'
import { LoginWordmark } from '@/components/login-wordmark'

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectTo } = await searchParams

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <LoginWordmark />
      <div className="relative z-10 min-h-75 w-full max-w-sm">
        <LoginForm redirectTo={redirectTo ?? ''} />
      </div>
    </div>
  )
}
