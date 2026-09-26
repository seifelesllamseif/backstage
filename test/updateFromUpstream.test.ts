import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// Runs scripts/update-from-upstream.sh (DRY_RUN) against throwaway repos that
// reproduce what "Deploy with Vercel" leaves behind: a fresh repo, one
// snapshot commit, no shared history with upstream. Built from scratch rather
// than from this repo's history, because CI checks out shallow.

const SCRIPT = resolve(__dirname, '../scripts/update-from-upstream.sh')
const root = mkdtempSync(join(tmpdir(), 'bs-update-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1'
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' }).trim()

function write(dir: string, files: Record<string, string>) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), body)
  }
}

// Upstream: v0.1.0, then a release that fixes app.txt and edits a doc that is
// tracked even though .gitignore matches it (as docs/ is in the real repo).
const upstream = join(root, 'upstream')
mkdirSync(upstream)
git(upstream, 'init', '-q', '-b', 'main')
write(upstream, {
  'package.json': '{\n  "version": "0.1.0"\n}\n',
  'app.txt': 'line1\nline2\n',
  'README.md': '# Backstage\n',
  '.gitignore': '/docs\n',
  'docs/guide.md': 'guide v1\n'
})
git(upstream, 'add', '-A', '-f')
git(upstream, 'commit', '-q', '-m', 'v0.1.0')
git(upstream, 'tag', 'v0.1.0')
const v010 = git(upstream, 'rev-parse', 'HEAD')
write(upstream, {
  'package.json': '{\n  "version": "0.2.0"\n}\n',
  'app.txt': 'line1\nline2 fixed\n',
  'docs/guide.md': 'guide v2\n'
})
git(upstream, 'add', '-A', '-f')
git(upstream, 'commit', '-q', '-m', 'v0.2.0')

let copies = 0
// A one-click copy of upstream at v0.1.0. `keepIgnored` = the copier kept
// tracked-but-ignored files; without it they are dropped, as `git add -A`
// on extracted files would.
function oneClickCopy(keepIgnored: boolean) {
  const dir = join(root, `copy${copies++}`)
  mkdirSync(dir)
  execFileSync(
    'sh',
    ['-c', `git -C "${upstream}" archive v0.1.0 | tar -x -C "${dir}"`],
    { env: ENV }
  )
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'add', '-A', ...(keepIgnored ? ['-f'] : []))
  git(dir, 'commit', '-q', '-m', 'Initial commit')
  return dir
}

function update(dir: string) {
  const r = spawnSync('bash', [SCRIPT], {
    cwd: dir,
    env: {
      ...ENV,
      UPSTREAM: upstream,
      DRY_RUN: '1',
      GITHUB_STEP_SUMMARY: '/dev/null'
    },
    encoding: 'utf8'
  })
  const out = Object.fromEntries(
    r.stdout
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => l.split('=', 2) as [string, string])
  )
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr }
}

describe('update-from-upstream.sh', () => {
  it('updates an exact copy and keeps the deployer’s own edits', () => {
    const dir = oneClickCopy(true)
    write(dir, { 'README.md': '# Acme Backstage\n' })
    git(dir, 'commit', '-q', '-am', 'our branding')

    const { code, out, stderr } = update(dir)
    expect(code, stderr).toBe(0)
    expect(out.status).toBe('merged')
    expect(out.base).toBe(v010)
    expect(out.restored).toBe('0')
    expect(git(dir, 'show', `${out.commit}:app.txt`)).toBe('line1\nline2 fixed')
    expect(git(dir, 'show', `${out.commit}:README.md`)).toBe('# Acme Backstage')
  })

  it('updates a copy that lost its gitignored files without conflicting on them', () => {
    const dir = oneClickCopy(false)
    expect(() => git(dir, 'cat-file', '-e', 'HEAD:docs/guide.md')).toThrow()

    const { code, out, stderr } = update(dir)
    expect(code, stderr).toBe(0)
    expect(out.status).toBe('merged')
    expect(out.base).toBe(v010)
    expect(out.restored).toBe('1')
    expect(git(dir, 'show', `${out.commit}:docs/guide.md`)).toBe('guide v2')
    expect(git(dir, 'show', `${out.commit}:app.txt`)).toBe('line1\nline2 fixed')
  })

  it('stops, and names the file, when the deployer edited the same lines', () => {
    const dir = oneClickCopy(true)
    write(dir, { 'app.txt': 'line1\nline2 ours\n' })
    git(dir, 'commit', '-q', '-am', 'local fix')

    const { code, out, stdout } = update(dir)
    expect(code).toBe(1)
    expect(out.status).toBe('conflict')
    expect(stdout).toContain('app.txt')
  })

  it('is a plain no-op once the update is merged', () => {
    const dir = oneClickCopy(true)
    const first = update(dir)
    git(dir, 'merge', '-q', '--ff-only', first.out.commit)

    const second = update(dir)
    expect(second.code).toBe(0)
    expect(second.out.status).toBe('up-to-date')
  })
})
