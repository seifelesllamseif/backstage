import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces, Geist_Mono } from 'next/font/google'
import '@/styles/globals.css'
import 'sonner/dist/styles.css'
import { cn } from '@/lib/utils'
import { Providers } from './providers'
import { ServiceWorkerRegistrar } from './_components/ServiceWorkerRegistrar'

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin']
})

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

// Used by next/metadata to resolve relative URLs in openGraph + twitter
// tags (e.g. og:image and og:url on /share/[ref]) into absolute URLs.
// VERCEL_PROJECT_PRODUCTION_URL is set automatically by Vercel; falls
// back to NEXT_PUBLIC_SITE_URL for local + custom deployments, then to
// localhost for dev.
const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Verbivore',
  description:
    'Internal ops platform for Verbivore projects, tasks, and handoffs.',
  applicationName: 'Verbivore',
  appleWebApp: {
    capable: true,
    title: 'Verbivore',
    statusBarStyle: 'black-translucent'
  },
  icons: {
    icon: [
      { url: '/logos/favicon.svg', type: 'image/svg+xml' },
      { url: '/logos/favicon.ico', sizes: '32x32' }
    ],
    apple: [{ url: '/logos/apple-touch-icon-180x180.png', sizes: '180x180' }],
    shortcut: '/logos/favicon.ico'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1414' }
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'h-full',
        'antialiased',
        dmSans.variable,
        fraunces.variable,
        geistMono.variable,
        'font-sans'
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
