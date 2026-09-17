import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

// Request-scoped identity override, for callers that authenticate with
// something other than a browser session.
//
// Why this exists: getCurrentTeamMember() resolves "who is this and which
// workspace are they in" from a cookie. A protocol client (an MCP bearer
// token, a signed webhook) has no cookie, and on a multi-workspace
// account there is nothing to disambiguate with — the cookie-less path
// would fall through to "most recently used workspace" and silently act
// in the wrong one.
//
// AsyncLocalStorage, not React's cache(): cache() only memoizes while a
// React render dispatcher is installed, and a route handler has none — it
// silently re-runs the factory, so the slot set here was never the slot
// read in lib/dal.ts and every MCP call redirected to /login. ALS is scoped
// by the run() below and by nothing else, which is the isolation guarantee:
// no global for a concurrent request to observe.
//
// SECURITY: setRequestIdentity() bypasses session verification entirely.
// Only call it after independently verifying a credential, and only with
// a userId that came out of that verification — never from user input.
type RequestIdentity = { userId: string; companyId: string }

const storage = new AsyncLocalStorage<{ current: RequestIdentity | null }>()

// Wrap the whole request. Identity isn't known until the credential is
// verified partway in, so the scope opens empty and is filled later.
export function runWithRequestIdentity<T>(fn: () => T): T {
  return storage.run({ current: null }, fn)
}

export function setRequestIdentity(identity: RequestIdentity): void {
  const store = storage.getStore()
  // Fail loudly: silently dropping the override is exactly the bug this
  // rewrite fixes, and the caller would fall back to cookie resolution.
  if (!store) {
    throw new Error(
      'setRequestIdentity() called outside runWithRequestIdentity().'
    )
  }
  store.current = identity
}

export function getRequestIdentity(): RequestIdentity | null {
  return storage.getStore()?.current ?? null
}
