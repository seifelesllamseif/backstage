import { fetchInviteByToken } from '@/supabase/dashboard/team'
import { InviteAcceptForm } from './_form'

const TIER_LABEL = {
  admin: 'an admin',
  lead: 'a lead',
  member: 'a team member'
} as const

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await fetchInviteByToken(token)

  if ('error' in result) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-medium text-zinc-900">
            This invite is no longer valid
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{result.error}</p>
          <p className="mt-4 text-xs text-zinc-500">
            Ask whoever invited you to send a fresh link.
          </p>
        </div>
      </div>
    )
  }

  const { invite } = result
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-base font-medium text-zinc-900">
          Join {invite.companyName}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {invite.inviterName ? `${invite.inviterName} invited` : 'You were invited'}{' '}
          you to join as {TIER_LABEL[invite.accessTier]}.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Your login
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-900 break-all">
            {invite.loginEmail}
          </p>
          <p className="mt-2 text-[11px] text-zinc-600">
            Once you accept, the password will be sent in the welcome email (or
            check the one we already sent to{' '}
            <span className="font-medium text-zinc-800">{invite.contactEmail}</span>).
          </p>
        </div>

        <div className="mt-5">
          <InviteAcceptForm token={token} />
        </div>
      </div>
    </div>
  )
}
