import { resolveVeroMediaUrl } from '@/lib/vero-api'

export type SellBanner = {
  id: string
  title: string
  body: string
  ctaLabel: string
  imageUrl: string | null
  active: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

export function resolveSellBannerImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}
