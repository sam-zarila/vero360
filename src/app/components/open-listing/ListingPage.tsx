import OpenListingView from '@/app/components/open-listing/OpenListingView'
import FoodProductView from '@/app/components/open-listing/FoodProductView'
import MarketplaceProductView from '@/app/components/open-listing/MarketplaceProductView'
import {
  listingFromProps,
  listingMetadata,
  type ListingKind,
  type ListingPageProps,
} from '@/lib/open-listing'

export const dynamic = 'force-dynamic'

export function listingGenerateMetadata(kind: ListingKind) {
  return (props: ListingPageProps) => listingMetadata(kind, props)
}

export function ListingPage(kind: ListingKind) {
  return async function Page(props: ListingPageProps) {
    const listing = await listingFromProps(kind, props)
    if (kind === 'marketplace') {
      return <MarketplaceProductView listing={listing} />
    }
    if (kind === 'food') {
      return <FoodProductView listing={listing} />
    }
    return <OpenListingView listing={listing} />
  }
}
