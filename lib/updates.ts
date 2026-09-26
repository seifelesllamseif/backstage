import 'server-only'

import { cacheLife } from 'next/cache'
import { z } from 'zod'
import pkg from '@/package.json'

// Self-hosted deployments are copies of the repo frozen at the moment someone
// clicked "Deploy with Vercel". Nothing tells them a fix exists unless the
// running app asks. This is that question: compare the version baked in at
// build time with release.json on upstream main, and tell an admin.
//
// release.json carries two numbers:
//   latest       - newest release. Below it: "update available", dismissible.
//   minSupported - oldest release still considered safe. Below it: "update
//                  required", not dismissible. Raise it when a release fixes
//                  something a deployment must not keep running (a security
//                  hole, a data-loss bug) - that is the whole point of it.
//
// BACKSTAGE_RELEASE_URL overrides the source; set it to an empty string to
// switch the check off (a fork that has diverged on purpose).

export const APP_VERSION: string = pkg.version

const DEFAULT_RELEASE_URL =
  'https://raw.githubusercontent.com/seifelesllamseif/backstage/main/release.json'

const Release = z.object({
  latest: z.string().max(20),
  minSupported: z.string().max(20),
  reason: z.string().max(300).optional()
})
type Release = z.infer<typeof Release>

export type UpdateStatus = {
  current: string
  latest: string
  level: 'available' | 'required'
  reason: string | null
  updateUrl: string
}

// Numeric compare of dotted versions. Enough for our own x.y.z releases; a
// pre-release suffix is ignored rather than mis-ordered.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return Math.sign(d)
  }
  return 0
}

export function updateStatusFor(
  current: string,
  release: Release | null,
  updateUrl: string
): UpdateStatus | null {
  if (!release) return null
  const base = {
    current,
    latest: release.latest,
    reason: release.reason ?? null,
    updateUrl
  }
  if (compareVersions(current, release.minSupported) < 0) {
    return { ...base, level: 'required' }
  }
  if (compareVersions(current, release.latest) < 0) {
    return { ...base, reason: null, level: 'available' }
  }
  return null
}

// Hourly, and a failed fetch caches as "no news" for the same hour: GitHub
// being down must never turn into an error in someone's dashboard.
async function fetchRelease(url: string): Promise<Release | null> {
  'use cache'
  cacheLife('hours')
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Release.parse(await res.json())
  } catch {
    return null
  }
}

// Where the Update button goes. On Vercel we know the deployment's own repo
// (system env vars), so it can land straight on the workflow's "Run" page;
// anywhere else, the written instructions.
function updateUrl(): string {
  const { VERCEL_GIT_PROVIDER, VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG } =
    process.env
  if (
    VERCEL_GIT_PROVIDER === 'github' &&
    VERCEL_GIT_REPO_OWNER &&
    VERCEL_GIT_REPO_SLUG
  ) {
    return `https://github.com/${VERCEL_GIT_REPO_OWNER}/${VERCEL_GIT_REPO_SLUG}/actions/workflows/update-from-upstream.yml`
  }
  return 'https://github.com/seifelesllamseif/backstage/blob/main/DEPLOY.md#updating'
}

export async function getUpdateStatus(): Promise<UpdateStatus | null> {
  const url = process.env.BACKSTAGE_RELEASE_URL ?? DEFAULT_RELEASE_URL
  if (!url) return null
  return updateStatusFor(APP_VERSION, await fetchRelease(url), updateUrl())
}
