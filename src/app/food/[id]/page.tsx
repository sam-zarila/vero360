import {
  ListingPage,
  listingGenerateMetadata,
} from '@/app/components/open-listing/ListingPage'

export const dynamic = 'force-dynamic'
export const generateMetadata = listingGenerateMetadata('food')
export default ListingPage('food')
