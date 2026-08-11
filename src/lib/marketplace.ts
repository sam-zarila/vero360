import {
  cleanContactEmail,
  cleanContactPhone,
  partyContactLine,
  partyFirebaseUid,
} from '@/lib/orders'
import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

/** Same collection as Flutter `MarketplaceService` photo/list overlays. */
export const MARKETPLACE_ITEMS_COLLECTION = 'marketplace_items'

export const MARKETPLACE_CATEGORIES = [
  'food',
  'drinks',
  'electronics',
  'clothes',
  'shoes',
  'other',
] as const

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number]

export type MarketplaceListing = {
  /** Admin key used for delete: Firestore doc id, or `api:{sqlId}`. */
  key: string
  firestoreDocId: string | null
  /** Nest SQL id when known (`sqlItemId` / `backendId` / numeric id). */
  sqlId: number | null
  name: string
  image: string | null
  gallery: string[]
  price: number
  description: string | null
  location: string
  category: MarketplaceCategory | string
  isActive: boolean
  merchantName: string | null
  merchantEmail: string | null
  merchantPhone: string | null
  merchantFirebaseUid: string | null
  ownerId: number | null
  createdAt: string | null
  latitude: number | null
  longitude: number | null
  source: 'firestore' | 'api'
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
  const n = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
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

function parseCategory(raw: unknown): MarketplaceCategory | string {
  const c = str(raw).toLowerCase()
  if ((MARKETPLACE_CATEGORIES as readonly string[]).includes(c)) return c
  return c || 'other'
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(x => str(x)).filter(Boolean)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    try {
      const decoded = JSON.parse(raw)
      if (Array.isArray(decoded)) return decoded.map(x => str(x)).filter(Boolean)
    } catch {
      // fall through
    }
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  return []
}

function galleryOf(row: Record<string, unknown>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of [...parseStringList(row.gallery), ...parseStringList(row.galleryUrls)]) {
    if (seen.has(g)) continue
    seen.add(g)
    out.push(g)
  }
  return out
}

function pickImage(row: Record<string, unknown>): string | null {
  for (const key of ['image', 'imageUrl', 'photo', 'picture', 'coverImage']) {
    const s = str(row[key])
    if (s) return s
  }
  const gallery = galleryOf(row)
  return gallery[0] || null
}

function ownerFromRow(row: Record<string, unknown>): Record<string, unknown> | null {
  return (
    asRecord(row.owner) ||
    asRecord(row.merchant) ||
    asRecord(row.seller) ||
    asRecord(row.serviceProvider)
  )
}

function stablePositiveIdFromString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) & 0x7fffffff
  }
  return hash === 0 ? 1 : hash
}

function resolveSqlId(row: Record<string, unknown>, fallbackDocId?: string): number | null {
  const fromFields =
    nullableNum(row.sqlItemId) ||
    nullableNum(row.backendId) ||
    nullableNum(row.itemId) ||
    nullableNum(row.apiItemId) ||
    nullableNum(row.apiId)
  if (fromFields && fromFields > 0) return fromFields
  const rawId = nullableNum(row.id ?? row.ID)
  if (rawId && rawId > 0 && (!fallbackDocId || String(rawId) !== fallbackDocId)) {
    return rawId
  }
  return null
}

/** Parse Nest `GET /marketplace` response (`{ data: [...] }`). */
export function parseMarketplaceListings(body: unknown): MarketplaceListing[] {
  return unwrapList(body)
    .map(row => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row)
    .map((row): MarketplaceListing | null => {
      const owner = ownerFromRow(row)
      const rawPhone = owner ? str(owner.phone) : ''
      const sqlId = resolveSqlId(row)
      const name = str(row.name)
      if (!sqlId || !name) return null

      const merchantName =
        str(row.merchantName) ||
        str(row.sellerBusinessName) ||
        (owner
          ? str(owner.businessName) || str(owner.name) || str(owner.displayName)
          : '') ||
        null

      return {
        key: `api:${sqlId}`,
        firestoreDocId: null,
        sqlId,
        name,
        image: pickImage(row),
        gallery: galleryOf(row),
        price: num(row.price),
        description: str(row.description) || null,
        location: str(row.location) || '—',
        category: parseCategory(row.category),
        isActive: row.isActive !== false,
        merchantName,
        merchantEmail: owner
          ? cleanContactEmail(str(owner.email) || str(owner.contactEmail))
          : cleanContactEmail(str(row.merchantEmail)),
        merchantPhone: cleanContactPhone(rawPhone) || cleanContactPhone(str(row.merchantPhone)),
        merchantFirebaseUid:
          str(row.ownerFirebaseUid) ||
          partyFirebaseUid(owner, rawPhone) ||
          str(row.merchantId) ||
          str(row.sellerUserId) ||
          null,
        ownerId: nullableNum(row.ownerId),
        createdAt: tsToIso(row.createdAt),
        latitude: nullableNum(row.latitude ?? row.lat),
        longitude: nullableNum(row.longitude ?? row.lng),
        source: 'api',
      }
    })
    .filter((item): item is MarketplaceListing => item != null)
}

/**
 * Parse a Firestore `marketplace_items` document — same fields as
 * Flutter `MarketplaceService._fromFirestoreDoc`.
 */
export function parseFirestoreMarketplaceListing(
  docId: string,
  data: Record<string, unknown>,
): MarketplaceListing | null {
  const name = str(data.name)
  if (!name) return null
  if (data.isActive === false) return null

  const sqlId = resolveSqlId(data, docId)
  const image = pickImage(data)
  const merchantUid =
    str(data.merchantId) ||
    str(data.sellerUserId) ||
    str(data.ownerFirebaseUid) ||
    null

  return {
    key: docId,
    firestoreDocId: docId,
    sqlId,
    name,
    image,
    gallery: galleryOf(data),
    price: num(data.price),
    description: str(data.description) || null,
    location: str(data.location) || '—',
    category: parseCategory(data.category),
    isActive: data.isActive !== false,
    merchantName:
      str(data.merchantName) ||
      str(data.sellerBusinessName) ||
      null,
    merchantEmail: cleanContactEmail(str(data.merchantEmail) || str(data.email)),
    merchantPhone: cleanContactPhone(str(data.phone) || str(data.merchantPhone)),
    merchantFirebaseUid: merchantUid,
    ownerId: nullableNum(data.merchantBackendId ?? data.backendUserId ?? data.ownerId),
    createdAt: tsToIso(data.createdAt),
    latitude: nullableNum(data.latitude ?? data.lat),
    longitude: nullableNum(data.longitude ?? data.lng),
    source: 'firestore',
  }
}

/**
 * Prefer Firestore (app source of truth for browse/photo), then fill gaps from Nest API.
 */
export function mergeMarketplaceListings(
  firestoreItems: MarketplaceListing[],
  apiItems: MarketplaceListing[],
): MarketplaceListing[] {
  const out = [...firestoreItems]
  const sqlSeen = new Set(
    firestoreItems.map(i => i.sqlId).filter((n): n is number => n != null && n > 0),
  )
  const namePriceSeen = new Set(
    firestoreItems.map(
      i => `${i.name.toLowerCase()}|${Math.round(i.price)}|${i.location.toLowerCase()}`,
    ),
  )

  for (const item of apiItems) {
    if (item.sqlId && sqlSeen.has(item.sqlId)) continue
    const fingerprint = `${item.name.toLowerCase()}|${Math.round(item.price)}|${item.location.toLowerCase()}`
    if (namePriceSeen.has(fingerprint)) continue
    out.push(item)
    if (item.sqlId) sqlSeen.add(item.sqlId)
    namePriceSeen.add(fingerprint)
  }

  return out
}

export function categoryLabel(category: string) {
  const c = category.toLowerCase()
  if (c === 'other') return 'Other'
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Other'
}

export function categoryTone(category: string): { bg: string; color: string; border: string } {
  switch (category.toLowerCase()) {
    case 'food':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'drinks':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'electronics':
      return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' }
    case 'clothes':
      return { bg: '#FDF2F8', color: '#BE185D', border: '#FBCFE8' }
    case 'shoes':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function resolveMarketplaceImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export function countByCategory(items: MarketplaceListing[]) {
  const counts: Record<string, number> = { all: items.length }
  for (const cat of MARKETPLACE_CATEGORIES) {
    counts[cat] = items.filter(i => i.category === cat).length
  }
  return counts
}

export { formatDateTime, formatMwk, partyContactLine, stablePositiveIdFromString }
