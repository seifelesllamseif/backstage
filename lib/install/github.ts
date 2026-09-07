import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { addToClientConfig, addToServerConfig, isValidPluginId } from './config'

// Installing a plugin = commit its folder plus the two config lines to this
// deployment's own repo, then let the platform rebuild. Next compiles
// plugins at build time (PLUGINS.md), so a commit is the only honest
// "install" — there is no runtime module loading to fall back on.

const API = 'https://api.github.com'

export type InstallTarget = { owner: string; repo: string; branch: string }

/**
 * Which repo this deployment builds from.
 *
 * Vercel exposes VERCEL_GIT_* at runtime (autoExposeSystemEnvs is on by
 * default), so a deploy-your-own install already knows its own repo and asks
 * the operator for nothing. GITHUB_INSTALL_REPO stays as an override for
 * self-hosters who build somewhere else.
 */
export function getInstallRepo(): InstallTarget | null {
  const branch =
    process.env.GITHUB_INSTALL_BRANCH ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    'main'

  const explicit = process.env.GITHUB_INSTALL_REPO
  if (explicit) {
    const [owner, repo] = explicit.split('/')
    return owner && repo ? { owner, repo, branch } : null
  }

  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const repo = process.env.VERCEL_GIT_REPO_SLUG
  return owner && repo ? { owner, repo, branch } : null
}

// The token is the only thing a human has to supply. It lives in
// app_secrets rather than env so an admin can set it from Settings without a
// redeploy — same store as the VAPID keys (lib/push.ts). Env still wins if
// set, for deployments that manage secrets that way.
export const INSTALL_TOKEN_KEY = 'github_install_token'

export async function getInstallToken(): Promise<string | null> {
  if (process.env.GITHUB_INSTALL_TOKEN) return process.env.GITHUB_INSTALL_TOKEN
  const { data } = await createAdminClient()
    .from('app_secrets')
    .select('value')
    .eq('key', INSTALL_TOKEN_KEY)
    .maybeSingle()
  return data?.value ?? null
}

export async function getInstallTarget(): Promise<InstallTarget | null> {
  const repo = getInstallRepo()
  if (!repo) return null
  return (await getInstallToken()) ? repo : null
}

// Registry entries point at a directory: .../<owner>/<repo>/tree/<ref>/<path>
export function parsePluginSource(repoUrl: string) {
  const m =
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+?)\/?$/.exec(
      repoUrl
    )
  if (!m) return null
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4] }
}

async function gh(path: string, token: string | null, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers
    }
  })
  if (!res.ok) {
    throw new Error(`GitHub ${init?.method ?? 'GET'} ${path}: ${res.status}`)
  }
  return res.json()
}

type FileBlob = { path: string; contentBase64: string }

// Read every file of the plugin folder out of the (public) source repo.
async function readPluginFolder(
  src: NonNullable<ReturnType<typeof parsePluginSource>>,
  id: string,
  token: string
): Promise<FileBlob[]> {
  const tree = (await gh(
    `/repos/${src.owner}/${src.repo}/git/trees/${src.ref}?recursive=1`,
    token
  )) as { tree: { path: string; type: string; sha: string }[] }

  const prefix = `${src.path.replace(/\/$/, '')}/`
  const entries = tree.tree.filter(
    (t) => t.type === 'blob' && t.path.startsWith(prefix)
  )
  if (entries.length === 0) throw new Error('Plugin folder is empty.')

  return Promise.all(
    entries.map(async (e) => {
      const blob = (await gh(
        `/repos/${src.owner}/${src.repo}/git/blobs/${e.sha}`,
        token
      )) as { content: string }
      return {
        // Rewrite to the target's own plugins/<id>/ — never trust the source
        // path to decide where we write.
        path: `plugins/${id}/${e.path.slice(prefix.length)}`,
        contentBase64: blob.content.replace(/\n/g, '')
      }
    })
  )
}

async function readText(
  t: InstallTarget,
  path: string,
  token: string
): Promise<string> {
  const file = (await gh(
    `/repos/${t.owner}/${t.repo}/contents/${path}?ref=${t.branch}`,
    token
  )) as { content: string }
  return Buffer.from(file.content, 'base64').toString('utf8')
}

const toBase64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')

/**
 * Copies the plugin folder and registers it, in a single commit so the repo
 * is never left with code that nothing imports (or an import with no code).
 * Returns the commit's html_url.
 */
export async function installPluginToRepo(
  target: InstallTarget,
  id: string,
  repoUrl: string
): Promise<string> {
  if (!isValidPluginId(id)) throw new Error(`Bad plugin id: ${id}`)
  const src = parsePluginSource(repoUrl)
  if (!src) throw new Error('Plugin source URL is not a GitHub tree URL.')

  const token = await getInstallToken()
  if (!token) throw new Error('No GitHub token configured.')

  const [files, clientConfig, serverConfig] = await Promise.all([
    readPluginFolder(src, id, token),
    readText(target, 'plugins.config.ts', token),
    readText(target, 'plugins.config.server.ts', token)
  ])

  const all: FileBlob[] = [
    ...files,
    {
      path: 'plugins.config.ts',
      contentBase64: toBase64(addToClientConfig(clientConfig, id))
    },
    {
      path: 'plugins.config.server.ts',
      contentBase64: toBase64(addToServerConfig(serverConfig, id))
    }
  ]

  const base = `/repos/${target.owner}/${target.repo}`
  const ref = (await gh(`${base}/git/ref/heads/${target.branch}`, token)) as {
    object: { sha: string }
  }
  const head = ref.object.sha
  const headCommit = (await gh(`${base}/git/commits/${head}`, token)) as {
    tree: { sha: string }
  }

  const blobs = await Promise.all(
    all.map(async (f) => {
      const blob = (await gh(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: f.contentBase64, encoding: 'base64' })
      })) as { sha: string }
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha }
    })
  )

  const tree = (await gh(`${base}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: blobs })
  })) as { sha: string }

  const commit = (await gh(`${base}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message: `feat(plugins): install ${id}\n\nInstalled from ${repoUrl} via the in-app Marketplace.`,
      tree: tree.sha,
      parents: [head]
    })
  })) as { sha: string; html_url: string }

  await gh(`${base}/git/refs/heads/${target.branch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha })
  })

  return commit.html_url
}
