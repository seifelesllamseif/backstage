import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Verbivore',
    short_name: 'Verbivore',
    description:
      'Internal ops platform for Verbivore projects, tasks, and handoffs.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1414',
    theme_color: '#0E1414',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/logos/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: '/logos/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logos/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/logos/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    screenshots: [
      {
        src: '/logos/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide'
      },
      {
        src: '/logos/screenshot-narrow.png',
        sizes: '720x1280',
        type: 'image/png',
        form_factor: 'narrow'
      }
    ],
    shortcuts: [
      {
        name: 'Board',
        url: '/dashboard/board',
        icons: [{ src: '/logos/shortcut-96x96.png', sizes: '96x96' }]
      },
      {
        name: 'My tasks',
        url: '/dashboard?view=mine',
        icons: [{ src: '/logos/shortcut-96x96.png', sizes: '96x96' }]
      }
    ]
  }
}
