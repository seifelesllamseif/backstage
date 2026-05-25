import type { Metadata, Viewport } from 'next'

import '@/styles/globals.css'

export const viewport: Viewport = {
  themeColor: '#000000'
}

export const metadata: Metadata = {
  title: {
    default: 'VerbivoreTeam',
    template: 'VerbivoreTeam | %s'
  },
  description: 'The internal portal for the Verbivoreteam.',
  icons: {
    icon: [
      {
        url: '/favicons/favicon-light.svg',
        media: '(prefers-color-scheme: dark)'
      },
      {
        url: '/favicons/favicon-dark.svg',
        media: '(prefers-color-scheme: light)'
      }
    ]
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
