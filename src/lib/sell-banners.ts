import { resolveVeroMediaUrl } from '@/lib/vero-api'

export type SellBannerAudience =
  | 'marketplace'
  | 'food'
  | 'accommodation'
  | 'driver'
  /** @deprecated use marketplace */
  | 'merchant'

export type SellBanner = {
  id: string
  title: string
  body: string
  ctaLabel: string
  imageUrl: string | null
  /** Which signup guide the CTA opens. */
  audience: SellBannerAudience
  active: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

export const SELL_BANNER_AUDIENCES: SellBannerAudience[] = [
  'marketplace',
  'food',
  'accommodation',
  'driver',
]

export function isSellBannerAudience(value: unknown): value is SellBannerAudience {
  return (
    value === 'marketplace' ||
    value === 'food' ||
    value === 'accommodation' ||
    value === 'driver' ||
    value === 'merchant'
  )
}

/** Normalized audience (never the deprecated `merchant` alias). */
export type SellBannerAudienceKey = 'marketplace' | 'food' | 'accommodation' | 'driver'

export function parseSellBannerAudience(value: unknown): SellBannerAudienceKey {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'driver') return 'driver'
  if (raw === 'food' || raw === 'restaurant' || raw === 'restaurants') return 'food'
  if (raw === 'accommodation' || raw === 'stay' || raw === 'hotel') return 'accommodation'
  // merchant / marketplace / default
  return 'marketplace'
}

export function sellBannerHref(audience: SellBannerAudience | SellBannerAudienceKey): string {
  switch (parseSellBannerAudience(audience)) {
    case 'driver':
      return '/start-driving'
    case 'food':
      return '/start-selling/food'
    case 'accommodation':
      return '/start-selling/accommodation'
    default:
      return '/start-selling/marketplace'
  }
}

export function sellBannerAudienceLabel(audience: SellBannerAudience | SellBannerAudienceKey): string {
  switch (parseSellBannerAudience(audience)) {
    case 'driver':
      return 'Driver'
    case 'food':
      return 'Food & Restaurants'
    case 'accommodation':
      return 'Accommodation'
    default:
      return 'Marketplace'
  }
}

export function sellBannerDefaultTitle(audience: SellBannerAudience | SellBannerAudienceKey): string {
  switch (parseSellBannerAudience(audience)) {
    case 'driver':
      return 'Drive with Vero360'
    case 'food':
      return 'Sell food on Vero360'
    case 'accommodation':
      return 'List stays on Vero360'
    default:
      return 'Start selling on Vero360'
  }
}

export function sellBannerDefaultCta(audience: SellBannerAudience | SellBannerAudienceKey): string {
  switch (parseSellBannerAudience(audience)) {
    case 'driver':
      return 'Join as driver'
    case 'food':
      return 'Sell food'
    case 'accommodation':
      return 'List stays'
    default:
      return 'Sell now'
  }
}

export function resolveSellBannerImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}
