import { buyerFacingPrice } from '@/lib/buyer-commission'
import { formatMwk } from '@/lib/vero-api'
import type { ListingModel } from '@/lib/open-listing-types'

export function listingAmountMwk(listing: ListingModel): number {
  const n = Number(String(listing.price).replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  if (listing.kind === 'marketplace') return buyerFacingPrice(n)
  return n
}

export function listingPriceLabel(listing: ListingModel) {
  if (
    listing.kind === 'marketplace' ||
    listing.kind === 'shop' ||
    listing.kind === 'food'
  ) {
    const n = Number(String(listing.price).replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) {
      const shown = listing.kind === 'marketplace' ? buyerFacingPrice(n) : n
      return formatMwk(shown)
    }
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
