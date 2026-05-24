// Tiny slug helper. ASCII-only — non-ASCII characters are stripped, so
// names that produce an empty slug fall back to the supplied alternative
// (e.g. the email prefix). Idempotent: slugify(slugify(x)) === slugify(x).

export function slugify(input: string, fallback?: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes

  if (slug.length > 0) return slug;
  if (fallback) return slugify(fallback);
  return "user";
}
