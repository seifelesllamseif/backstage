import 'server-only'

import { cache } from 'react'

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
// React's cache() is per-request, so the object below is shared by
// everything in one request and by nothing across two. That is the whole
// isolation guarantee: there is no global here for a concurrent request
// to observe.
//
// SECURITY: setRequestIdentity() bypasses session verification entirely.
// Only call it after independently verifying a credential, and only with
// a userId that came out of that verification — never from user input.
type RequestIdentity = { userId: string; companyId: string }

const slot = cache((): { current: RequestIdentity | null } => ({
  current: null
}))

export function setRequestIdentity(identity: RequestIdentity): void {
  slot().current = identity
}

export function getRequestIdentity(): RequestIdentity | null {
  return slot().current
}
