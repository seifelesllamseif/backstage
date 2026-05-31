import { Suspense } from 'react'
import { redirect } from 'next/navigation'

type RawSearchParams = Promise<Record<string, string | string[] | undefined>>

export default function DashboardIndex({
  searchParams
}: {
  searchParams: RawSearchParams
}) {
  return (
    <Suspense fallback={null}>
      <Redirector searchParams={searchParams} />
    </Suspense>
  )
}

async function Redirector({
  searchParams
}: {
  searchParams: RawSearchParams
}): Promise<never> {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, item))
    else qs.set(k, v)
  }
  const tail = qs.toString()
  redirect(tail ? `/dashboard/board?${tail}` : '/dashboard/board')
}
