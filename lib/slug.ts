export function slugify(input: string, fallback?: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length > 0) return slug
  if (fallback) return slugify(fallback)
  return 'user'
}
