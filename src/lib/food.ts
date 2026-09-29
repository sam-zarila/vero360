import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'
import type { FoodItem, PublicFoodDetail } from '@/lib/food-types'
import {
  readJsonSafe,
  unwrapList,
  veroEndpoint,
} from '@/lib/vero-api'

export type { FoodItem, FoodSource, PublicFoodDetail } from '@/lib/food-types'

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

function parseGallery(data: Record<string, unknown>): string[] {
  for (const key of ['gallery', 'galleryUrls', 'images']) {
    const list = data[key]
    if (Array.isArray(list)) {
      return list.map(x => str(x)).filter(Boolean)
    }
    if (typeof list === 'string' && list.trim()) {
      try {
        const decoded = JSON.parse(list)
        if (Array.isArray(decoded)) {
          return decoded.map(x => str(x)).filter(Boolean)
        }
      } catch {
        return list
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      }
    }
  }
  return []
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
  const gallery = parseGallery(data)
  return gallery[0] ?? null
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
    .map((row): FoodItem | null => {
      const rawId = str(row.id) || str(row._id)
      const name = str(row.name) || str(row.FoodName)
      if (!rawId || !name) return null
      return {
        key: `api:${rawId}`,
        rawId,
        source: 'api',
        name,
        image: pickImage(row),
        gallery: parseGallery(row),
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
      }
    })
    .filter((item): item is FoodItem => item != null)
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
    gallery: parseGallery(data),
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
    gallery: parseGallery(data),
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function listingRows(body: unknown): Record<string, unknown>[] {
  const list = unwrapList(body)
  if (list.length) {
    return list
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => !!row)
  }
  const rec = asRecord(body)
  if (!rec) return []
  const nested =
    asRecord(rec.data) ||
    asRecord(rec.item) ||
    asRecord(rec.product) ||
    asRecord(rec.food)
  if (nested) return [nested]
  if (rec.id != null || rec.name != null || rec.FoodName != null) return [rec]
  return []
}

/** Public share page: resolve a dish by SQL id or Firestore doc id. */
export async function fetchPublicFoodById(id: string): Promise<PublicFoodDetail | null> {
  const headers = { Accept: 'application/json' }
  const sqlId = Number(id)

  if (Number.isFinite(sqlId) && sqlId > 0) {
    try {
      const res = await fetch(veroEndpoint('marketplace', sqlId), {
        headers,
        cache: 'no-store',
      })
      if (res.ok) {
        const body = await readJsonSafe(res)
        const row = listingRows(body)[0]
        if (row) {
          const items = parseApiFoodItems([row])
          if (items[0]) return items[0]
        }
      }
    } catch {
      // fall through to Firestore
    }
  }

  try {
    const db = getAdminDb()

    let menuDoc = await db.collection('food_menu_items').doc(id).get()
    if (menuDoc.exists) {
      const parsed = parseFirestoreMenuFood(
        menuDoc.id,
        menuDoc.data() as Record<string, unknown>,
      )
      if (parsed) return parsed
    }

    let mpDoc = await db.collection('marketplace_items').doc(id).get()
    if (!mpDoc.exists && Number.isFinite(sqlId) && sqlId > 0) {
      const snap = await db
        .collection('marketplace_items')
        .where('sqlItemId', '==', sqlId)
        .limit(1)
        .get()
      if (!snap.empty) mpDoc = snap.docs[0]!
    }
    if (mpDoc.exists) {
      const parsed = parseFirestoreMarketplaceFood(
        mpDoc.id,
        mpDoc.data() as Record<string, unknown>,
      )
      if (parsed) return parsed
    }
  } catch (err) {
    console.warn('Public food fetch failed:', err)
  }

  return null
}
