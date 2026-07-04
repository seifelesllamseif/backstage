import { redirect } from 'next/navigation'

// Marketing landing + live demo moved to the www repo
// (https://backstage-www.vercel.app). A self-hosted install's root is
// just the front door to the app.
export default function RootPage() {
  redirect('/login')
}
