import type { FoodSource } from '@/lib/food-types'
import { formatDateTime, formatMwk, resolveVeroMediaUrl } from '@/lib/vero-api'

export function sourceLabel(source: FoodSource) {
  switch (source) {
    case 'api':
      return 'Marketplace API'
    case 'marketplace':
      return 'Marketplace listing'
    case 'menu':
      return 'Kitchen menu'
  }
}

export function resolveFoodImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export { formatDateTime, formatMwk }
