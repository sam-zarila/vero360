import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

export type FoodSource = 'api' | 'marketplace' | 'menu'

export type FoodItem = {
  /** Stable admin key: `${source}:${rawId}` */
  key: string
  rawId: string
  source: FoodSource
  name: string
  image: string | null
  restaurant: string
  price: number
  description: string | null
  category: string
  merchantId: string | null
  location: string | null
  available: boolean
  latitude: number | null
  longitude: number | null
  createdAt: string | null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value))
  return Number.isFinite(n) ? n : null
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

function pickImage(data: Record<string, unknown>): string | null {
  for (const key of [
    'image',
    'imageUrl',
    'FoodImage',
    'photo',
    'picture',
    'coverImage',
    'coverUrl',
  ]) {
    const s = str(data[key])
    if (s) return s
  }
  for (const key of ['gallery', 'galleryUrls', 'images']) {
    const list = data[key]
    if (Array.isArray(list) && list[0]) {
      const s = str(list[0])
      if (s) return s
    }
  }
  return null
}

function sellerName(data: Record<string, unknown>): string {
  const nested = data.serviceProvider ?? data.merchant ?? data.seller
  if (nested && typeof nested === 'object') {
    const m = nested as Record<string, unknown>
    const fromNested =
      str(m.businessName) || str(m.name) || str(m.displayName) || str(m.merchantName)
    if (fromNested) return fromNested
  }
  return (
    str(data.businessName) ||
    str(data.merchantName) ||
    str(data.RestrauntName) ||
    str(data.restaurantName) ||
    'Local kitchen'
  )
}

function listingLocation(data: Record<string, unknown>): string | null {
  const loc = data.location
  if (typeof loc === 'string' && loc.trim()) return loc.trim()
  if (loc && typeof loc === 'object') {
    const m = loc as Record<string, unknown>
    for (const k of ['formattedAddress', 'address', 'name', 'label']) {
      const v = str(m[k])
      if (v) return v
    }
  }
  return str(data.address) || str(data.pickupAddress) || str(data.merchantAddress) || null
}

export function parseApiFoodItems(body: unknown): FoodItem[] {
  return unwrapList(body)
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter(row => {
      const cat = str(row.category).toLowerCase()
      return !cat || cat === 'food'
    })
    .map(row => {
      const rawId = str(row.id) || str(row._id)
      const name = str(row.name) || str(row.FoodName)
      if (!rawId || !name) return null
      return {
        key: `api:${rawId}`,
        rawId,
        source: 'api' as const,
        name,
        image: pickImage(row),
        restaurant: sellerName(row),
        price: num(row.price),
        description: str(row.description) || null,
        category: str(row.category) || 'food',
        merchantId: str(row.merchantId) || str(row.sellerUserId) || null,
        location: listingLocation(row),
        available: row.isActive !== false && row.isAvailable !== false,
        latitude: nullableNum(row.latitude ?? row.lat),
        longitude: nullableNum(row.longitude ?? row.lng),
        createdAt: tsToIso(row.createdAt),
      } satisfies FoodItem
    })
    .filter((item): item is FoodItem => !!item)
}

export function parseFirestoreMarketplaceFood(
  id: string,
  data: Record<string, unknown>,
): FoodItem | null {
  if (str(data.category).toLowerCase() !== 'food') return null
  if (data.isActive === false) return null
  const name = str(data.name) || str(data.FoodName)
  if (!name) return null
  return {
    key: `marketplace:${id}`,
    rawId: id,
    source: 'marketplace',
    name,
    image: pickImage(data),
    restaurant: sellerName(data),
    price: num(data.price),
    description: str(data.description) || null,
    category: 'food',
    merchantId: str(data.merchantId) || str(data.sellerUserId) || null,
    location: listingLocation(data),
    available: data.isActive !== false,
    latitude: nullableNum(data.latitude),
    longitude: nullableNum(data.longitude),
    createdAt: tsToIso(data.createdAt),
  }
}

export function parseFirestoreMenuFood(
  id: string,
  data: Record<string, unknown>,
): FoodItem | null {
  if (data.isAvailable === false) return null
  const name = str(data.name) || str(data.FoodName)
  if (!name) return null
  return {
    key: `menu:${id}`,
    rawId: id,
    source: 'menu',
    name,
    image: pickImage(data),
    restaurant: sellerName(data),
    price: num(data.price),
    description: str(data.description) || null,
    category: 'food',
    merchantId: str(data.merchantId) || null,
    location: listingLocation(data),
    available: data.isAvailable !== false,
    latitude: nullableNum(data.latitude),
    longitude: nullableNum(data.longitude),
    createdAt: tsToIso(data.createdAt),
  }
}

export function mergeFoodItems(lists: FoodItem[][]): FoodItem[] {
  const out: FoodItem[] = []
  for (const list of lists) {
    for (const item of list) {
      const dup = out.some(
        x =>
          x.name.toLowerCase() === item.name.toLowerCase() &&
          x.restaurant.toLowerCase() === item.restaurant.toLowerCase() &&
          Math.abs(x.price - item.price) < 0.01,
      )
      if (!dup) out.push(item)
    }
  }
  return out
}

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

export { formatMwk, formatDateTime }
