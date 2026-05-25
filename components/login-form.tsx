'use client'

import { startTransition, useActionState, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'

import { cn } from '@/lib/utils'
import { signIn, type LoginState } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
})

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginForm({
  className,
  redirectTo,
  ...props
}: React.ComponentProps<'div'> & { redirectTo: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined
  )
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function validateField(name: 'email' | 'password', value: string) {
    const result = loginSchema.shape[name].safeParse(value)
    setErrors((prev) => ({
      ...prev,
      [name]: result.success ? undefined : result.error.issues[0]?.message
    }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      email: fd.get('email'),
      password: fd.get('password')
    })

    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as 'email' | 'password' | undefined
        if (key && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    startTransition(() => formAction(fd))
  }

  return (
    <motion.div
      className={cn(
        'bg-card ring-foreground/10 relative w-full max-w-lg rounded-lg p-8 ring-1 md:p-10',
        className
      )}
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      <motion.div
        className="mb-7 flex flex-col items-center gap-4 text-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <Image
          src="/logo.png"
          alt="Verbivore"
          width={240}
          height={80}
          priority
          className="h-14 w-auto"
        />
        <p className="text-muted-foreground text-base">Welcome back! :)</p>
      </motion.div>

      <motion.form
        onSubmit={onSubmit}
        noValidate
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <input type="hidden" name="redirect" value={redirectTo} />
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="email" className="text-sm">
              Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              onBlur={(e) => validateField('email', e.currentTarget.value)}
              className="h-9 px-3 text-sm md:text-sm"
            />
            {errors.email && (
              <p className="text-destructive text-sm" role="alert">
                {errors.email}
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="password" className="text-sm">
              Password
            </FieldLabel>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="h-9 px-3 pr-8 text-sm md:text-sm"
                onBlur={(e) => validateField('password', e.currentTarget.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1.5 flex items-center transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-destructive text-sm" role="alert">
                {errors.password}
              </p>
            )}
          </Field>

          {state?.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}

          <Field>
            <Button
              type="submit"
              disabled={pending}
              className="h-9 px-3 text-sm md:text-sm"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </Field>
        </FieldGroup>
      </motion.form>
    </motion.div>
  )
}
