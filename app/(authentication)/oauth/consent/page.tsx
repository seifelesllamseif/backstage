import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { DEFAULT_LOGIN_ROUTE } from '@/routes'

// Supabase's OAuth 2.1 server redirects here with ?authorization_id when a
// client asks for access. This screen is core rather than part of the MCP
// plugin: `authorization_url_path` is one project-level setting serving every
// OAuth client, so uninstalling a plugin must not break it.

export const metadata = { title: 'Authorize access' }

export default async function ConsentPage({
  searchParams
}: {
  searchParams: Promise<{ authorization_id?: string }>
}) {
  const { authorization_id: authorizationId } = await searchParams
  if (!authorizationId) return <Problem>Missing authorization request.</Problem>

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    // Preserve the request across login so the client's flow survives it.
    redirect(
      `${DEFAULT_LOGIN_ROUTE}?redirect=${encodeURIComponent(
        `/oauth/consent?authorization_id=${authorizationId}`
      )}`
    )
  }

  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !data) {
    return (
      <Problem>{error?.message ?? 'Invalid authorization request.'}</Problem>
    )
  }

  // Already consented to these scopes — Supabase hands back a finished
  // redirect instead of details, so send the user straight on.
  if (!('authorization_id' in data)) redirect(data.redirect_url)

  const scopes = data.scope.split(' ').filter(Boolean)

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-base font-medium">Authorize {data.client.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          It will be able to act in your workspace as you, with your access
          tier.
        </p>

        {/* Redirect URI is shown deliberately: with dynamic client
            registration enabled, any client can register, so this screen is
            the only place a user can spot an impostor before approving. */}
        <dl className="mt-4 flex flex-col gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="opacity-60">Signed in as</dt>
            <dd className="truncate">{data.user.email}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="opacity-60">Sends you back to</dt>
            <dd className="break-all">{data.redirect_uri}</dd>
          </div>
          {scopes.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <dt className="opacity-60">Requested permissions</dt>
              <dd>
                <ul className="list-inside list-disc">
                  {scopes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <form
          action="/api/oauth/decision"
          method="POST"
          className="mt-6 flex gap-2"
        >
          <input
            type="hidden"
            name="authorization_id"
            value={authorizationId}
          />
          <button
            type="submit"
            name="decision"
            value="deny"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          >
            Deny
          </button>
          <button
            type="submit"
            name="decision"
            value="approve"
            className="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm"
          >
            Approve
          </button>
        </form>
      </div>
    </div>
  )
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <p className="max-w-sm text-center text-sm text-red-600">{children}</p>
    </div>
  )
}
