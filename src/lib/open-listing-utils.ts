import { formatMwk } from '@/lib/vero-api'
import type { ListingModel } from '@/lib/open-listing-types'

export function listingPriceLabel(listing: ListingModel) {
  if (listing.kind === 'marketplace' || listing.kind === 'shop') {
    const n = Number(String(listing.price).replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return formatMwk(n)
    if (!listing.price) return ''
    return `MWK ${listing.price}`
  }

  const n = Number(String(listing.price).replace(/,/g, ''))
  if (Number.isFinite(n) && n > 0) {
    const suffix = listing.period.startsWith('/')
      ? ` ${listing.period}`
      : listing.period
        ? ` ${listing.period}`
        : ' / night'
    return `${formatMwk(n)}${suffix}`
  }
  if (!listing.price) return ''
  return `MWK ${listing.price}${listing.period ? ` ${listing.period}` : ''}`
}
