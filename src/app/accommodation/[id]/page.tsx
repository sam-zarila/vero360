import {
  ListingPage,
  listingGenerateMetadata,
} from '@/app/components/open-listing/ListingPage'

export const dynamic = 'force-dynamic'
export const generateMetadata = listingGenerateMetadata('accommodation')
export default ListingPage('accommodation')
