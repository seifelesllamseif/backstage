import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import '@/styles/globals.css'
import 'sonner/dist/styles.css'
import { cn } from '@/lib/utils'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Verbivore',
  description:
    'Internal ops platform for Verbivore projects, tasks, and handoffs.',
  icons: { icon: '/logo-icon.png' }
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
        geistSans.variable,
        geistMono.variable,
        'font-sans',
        inter.variable
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
