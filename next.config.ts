import type { NextConfig } from 'next'

// Derive the Supabase storage hostname from NEXT_PUBLIC_SUPABASE_URL so
// changing projects (dev / staging / prod) doesn't need a config edit.
// Avatar uploads land at https://<ref>.supabase.co/storage/v1/object/public/avatars/...
const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return null
  }
})()

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Default is 1 MB, which strands the onboarding avatar upload mid-flight
  // (we allow up to 5 MB and the server action body has to fit the whole
  // file). 10 MB gives headroom without opening the floodgates for unrelated
  // actions.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
        pathname: '/**'
      },
      ...(supabaseHostname
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHostname,
              pathname: '/storage/v1/object/public/**'
            }
          ]
        : [])
    ]
  }
}

export default nextConfig
