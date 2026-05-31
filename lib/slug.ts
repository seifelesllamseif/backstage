// Slugs are served at the root (`/[slug]`) per decision 0029, so a generated
// slug that matches a concrete app route would shadow that route's owner.
// Append a numeric suffix when slugify would land on one of these.
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'cockpit',
  'dashboard',
  'favicon.ico',
  'login',
  'p',
  'portfolio',
  'profile',
  'projects',
  'public',
  'settings',
  '_next'
])

export function slugify(input: string, fallback?: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const base = slug.length > 0 ? slug : fallback ? slugify(fallback) : 'user'
  return RESERVED_SLUGS.has(base) ? `${base}-1` : base
}
