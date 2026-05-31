// Brand-mark inline SVGs used by the external-ref renderer. Lucide v1.16
// dropped the named brand icons (Github / Figma) so we ship them locally.
// Each component accepts `className` so the parent can size + color them
// the same way it sizes lucide icons.

import Image from 'next/image'

interface BrandProps {
  className?: string
}

export function GithubIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.68-1.27-1.68-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

export function FigmaIcon({ className }: BrandProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="#F24E1E" d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 1 0 0 8z" />
      <path fill="#A259FF" d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#0ACF83" d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 1 1 0 8h-4V0z" />
      <path fill="#1ABCFE" d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  )
}

// Verbivore brand mark - sourced from /public/logos/verbivore-icon.svg
// instead of inlined so the asset stays the single source of truth. Uses a
// regular <img> tag (not next/image) because brand chips are tiny and the
// image-optimizer adds no value at 12px.
export function VerbivoreIcon({ className }: BrandProps) {
  return (
    <Image
      src="/logos/verbivore-icon.svg"
      alt=""
      aria-hidden
      width={12}
      height={12}
      unoptimized
      className={`${className ?? ''} dark:invert`}
    />
  )
}

// Sentry's mark: an outer triangular silhouette with a smaller triangle
// cut out of the lower-left, forming the negative-space "eye". Single
// colour so it tints cleanly via currentColor.
export function SentryIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2.5L22.5 21H1.5L12 2.5zm0 5L5 19h4.5L12 14l2.5 5H19L12 7.5z" />
    </svg>
  )
}

// Google Cloud cloud silhouette, painted in Google's brand quadrant.
// Multi-colour like FigmaIcon, so the chip wrapper doesn't override it.
export function GoogleCloudIcon({ className }: BrandProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#EA4335"
        d="M14.5 7.5L18 11l-.5.5L13 7.5l1.5-1.5c0 .5 0 1 0 1.5z"
      />
      <path
        fill="#4285F4"
        d="M18 12a4 4 0 0 1 0 8h-5v-4h5a0 0 0 0 0 0 0 4 4 0 0 0-4-4h-1v-3l5 3z"
      />
      <path
        fill="#FBBC05"
        d="M11 13H8a4 4 0 0 0 0 8h4v-4H8a0 0 0 0 1 0 0 4 4 0 0 1 3-4z"
      />
      <path
        fill="#34A853"
        d="M11 5a6 6 0 0 1 5.5 3.5l-2 1.5A4 4 0 0 0 11 8.5 4 4 0 0 0 7.5 11l-2-1.5A6 6 0 0 1 11 5z"
      />
    </svg>
  )
}

// Stripe's "S" mark — a stylised lowercase s. Single colour; tinted via
// currentColor so the chip wrapper can paint it Stripe-blurple.
export function StripeIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M13.4 9.8c0-.9.8-1.3 2-1.3 1.7 0 3.9.5 5.6 1.5V4.8C19.2 4.1 17.4 3.8 15.4 3.8c-4.8 0-8 2.5-8 6.6 0 6.5 8.9 5.4 8.9 8.2 0 1-.9 1.4-2.4 1.4-1.8 0-4.2-.7-6.1-1.8v5.2c2.1.9 4.2 1.3 6.1 1.3 5 0 8.4-2.4 8.4-6.6 0-7-9-5.7-9-8.3z" />
    </svg>
  )
}

// Vercel's iconic mark: a solid filled triangle. Clean and recognisable.
export function VercelIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2L23 21H1L12 2z" />
    </svg>
  )
}

// WordPress "W" mark: stylised circle with a W cut-out, the official
// WordPress logotype. Single colour so the chip wrapper can tint it via
// currentColor (we paint it WordPress blue in refChipPalette).
export function WordPressIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.6a8.4 8.4 0 1 1 0 16.8A8.4 8.4 0 0 1 12 3.6zM6.3 7.6L9.5 16l1.9-5.6-1.5-4.5c-.3 0-.7.1-1 .1l.6 1.8h.4l-1.1 3.3-1.8-5.1c.4-.1.8-.1 1.1-.1H6.3zm8.4-.4l1.7 4.9-1.3 3.9-1.5-4.5-.4-1.2-1-3.1c.3 0 .7-.1 1-.1.3 0 .7 0 1 .1l-.3 1c.3-.1.6-.1 1-.1.3 0 .6.1.9.2l-.5.2c-.1 0-.3 0-.6.2v2.5zm-2.7 5.9l1.6 4.7c-.5.2-1 .3-1.6.3-.3 0-.6 0-.9-.1l1.5-4.8.4-.1zm-5.2-.7a8.6 8.6 0 0 0 4 7.4L7.1 14a13.8 13.8 0 0 1-.3-1.6zm10.5-.6l-2.6 7.5a8.6 8.6 0 0 0 4-7.4 9 9 0 0 0-.6-3.2c.4 1 .3 2.2-.8 3.1z" />
    </svg>
  )
}

// Resend "R" mark: a stylised paper-airplane arrow inscribed in a
// rounded square, painted in their signature near-black. Tints via
// currentColor so the chip wrapper can pick up the neutral palette.
export function ResendIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zm5 4v8h2v-3h1.5l2 3H16l-2.3-3.3c1-.4 1.6-1.3 1.6-2.4 0-1.6-1.2-2.6-3-2.6H8zm2 2h1.4c.8 0 1.3.3 1.3 1s-.5 1-1.3 1H10v-2z" />
    </svg>
  )
}

// GoDaddy heart: the standalone heart mark from the 2020 rebrand. Single
// colour so it tints to the brand teal via currentColor.
export function GoDaddyIcon({ className }: BrandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 21s-7.5-4.6-9.4-9.4C1.3 7.7 3.6 4 7.3 4c1.9 0 3.6 1 4.7 2.5C13.1 5 14.8 4 16.7 4c3.7 0 6 3.7 4.7 7.6C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

// Google Docs document mark: blue page silhouette with the folded corner
// and three horizontal text lines. Multi-colour so the chip wrapper does
// not override it.
export function GoogleDocsIcon({ className }: BrandProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      />
      <path fill="#A1C2FA" d="M14 2v6h6l-6-6z" />
      <path fill="#FFFFFF" d="M8 13h8v1.2H8zM8 15.5h8v1.2H8zM8 18h5v1.2H8z" />
    </svg>
  )
}

export function SupabaseIcon({ className }: BrandProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M13.976 23.625c-.629.792-1.903.358-1.92-.652l-.252-14.764h9.93c1.798 0 2.801 2.078 1.684 3.488L13.976 23.625z"
      />
      <path
        fill="currentColor"
        opacity="0.8"
        d="M10.024.375c.629-.792 1.903-.358 1.92.652l.111 14.764H2.226c-1.798 0-2.801-2.078-1.684-3.488L10.024.375z"
      />
    </svg>
  )
}
