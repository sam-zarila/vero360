import { resolveVeroMediaUrl } from '@/lib/vero-api'

export type SellBannerAudience = 'merchant' | 'driver'

export type SellBanner = {
  id: string
  title: string
  body: string
  ctaLabel: string
  imageUrl: string | null
  /** Who the CTA is for — merchant sell guide or driver signup. */
  audience: SellBannerAudience
  active: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

export function isSellBannerAudience(value: unknown): value is SellBannerAudience {
  return value === 'merchant' || value === 'driver'
}

export function parseSellBannerAudience(value: unknown): SellBannerAudience {
  return value === 'driver' ? 'driver' : 'merchant'
}

export function sellBannerHref(audience: SellBannerAudience): string {
  return audience === 'driver' ? '/start-driving' : '/start-selling'
}

export function resolveSellBannerImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}
