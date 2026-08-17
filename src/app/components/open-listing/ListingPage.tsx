import OpenListingView from '@/app/components/open-listing/OpenListingView'
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
    return <OpenListingView listing={listing} />
  }
}
