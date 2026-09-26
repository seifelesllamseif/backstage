import { Suspense } from 'react'
import { panelMetadata } from '../_components/panelMetadata'
import { requireFeature } from '@/lib/features/server'

export const metadata = panelMetadata('Onboarding')

// The feature gate sits inside Suspense so the route still has a static
// shell to prefetch: the click swaps the panel instantly and the gate
// resolves (and notFound()s, if the feature is off) a beat later. The page
// renders no UI either way - <DashboardChrome /> in the layout does.
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requireFeature('onboarding')
  return null
}
