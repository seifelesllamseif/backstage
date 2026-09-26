import { panelMetadata } from '../_components/panelMetadata'

export const metadata = panelMetadata('Marketplace')

// Always available (no requireFeature): the marketplace is where features
// get turned on in the first place. URL target only - the chrome in the
// layout mounts <MarketplacePanel/>.
export default function MarketplacePage() {
  return null
}
