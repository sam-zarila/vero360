import 'server-only'

import type { Metadata } from 'next'
import { getAdminDb } from '@/lib/firebase-admin'
import { parseFirestoreMarketplaceListing } from '@/lib/marketplace'
import type {
  ListingKind,
  ListingModel,
  ListingPageProps,
  ListingQuery,
} from '@/lib/open-listing-types'
import { parseStayListings } from '@/lib/stay'
import { USERS_COLLECTION } from '@/lib/users'
import {
  readJsonSafe,
  resolveVeroMediaUrl,
  unwrapList,
  veroEndpoint,
} from '@/lib/vero-api'

export type {
  ListingKind,
  ListingModel,
  ListingPageProps,
  ListingQuery,
} from '@/lib/open-listing-types'

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim()
  return (value ?? '').trim()
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
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
    asRecord(rec.accommodation) ||
    asRecord(rec.product)
  if (nested) return [nested]
  if (rec.id != null || rec.name != null) return [rec]
  return []
}

function parseAmenities(row: Record<string, unknown> | null): string[] {
  if (!row) return []
  const raw = row.amenities ?? row.servicesOffered ?? row.facilities ?? row.features
  if (Array.isArray(raw)) {
    return raw.map(x => String(x).trim()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

function periodSuffix(period: string | null | undefined): string {
  const p = (period ?? '').toLowerCase()
  if (p === 'day') return '/ day'
  if (p === 'month') return '/ month'
  if (p === 'night' || p) return p ? `/ ${p}` : '/ night'
  return '/ night'
}

function appPathForKind(kind: ListingKind): string {
  if (kind === 'shop') return 'shop'
  if (kind === 'marketplace') return 'marketplace'
  return 'accommodation'
}

async function fetchStayById(id: string) {
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return null

  const headers = { Accept: 'application/json' }
  const urls = [veroEndpoint('accommodations', n), veroEndpoint('accommodations', 'all')]

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' })
      if (!res.ok) continue
      const body = await readJsonSafe(res)
      const items = parseStayListings(listingRows(body))
      const stay = items.find(item => item.id === n)
      if (!stay) continue
      const raw = listingRows(body).find(row => Number(row.id ?? row.ID) === n) ?? null
      return { stay, amenities: parseAmenities(raw) }
    } catch {
      // try next url
    }
  }
  return null
}

async function fetchMarketplaceProductById(id: string) {
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
          const parsed = parseFirestoreMarketplaceListing('api', row)
          if (parsed) return parsed
        }
      }
    } catch {
      // fall through to Firestore
    }
  }

  try {
    const db = getAdminDb()
    let doc = await db.collection('marketplace_items').doc(id).get()
    if (!doc.exists && Number.isFinite(sqlId) && sqlId > 0) {
      const snap = await db
        .collection('marketplace_items')
        .where('sqlItemId', '==', sqlId)
        .limit(1)
        .get()
      if (!snap.empty) doc = snap.docs[0]!
    }
    if (doc.exists) {
      return parseFirestoreMarketplaceListing(
        doc.id,
        doc.data() as Record<string, unknown>,
      )
    }
  } catch (err) {
    console.warn('Public marketplace fetch failed:', err)
  }
  return null
}

async function fetchShopById(merchantId: string) {
  try {
    const db = getAdminDb()
    const doc = await db.collection(USERS_COLLECTION).doc(merchantId).get()
    if (!doc.exists) return null
    const d = doc.data() as Record<string, unknown>
    return {
      name:
        str(d.businessName) ||
        str(d.name) ||
        str(d.displayName) ||
        'Shop on Vero360',
      image:
        str(d.profilePicture) ||
        str(d.profilepicture) ||
        str(d.photoURL) ||
        str(d.logoUrl) ||
        null,
      description:
        str(d.businessDescription) ||
        str(d.description) ||
        str(d.bio) ||
        null,
      location: str(d.location) || str(d.city) || null,
    }
  } catch (err) {
    console.warn('Public shop fetch failed:', err)
    return null
  }
}

export async function listingFromProps(
  kind: ListingKind,
  props: ListingPageProps,
): Promise<ListingModel> {
  const params = (await props.params) ?? {}
  const query = (await props.searchParams) ?? {}
  const id = (params.id ?? '').trim()
  let name = first(query.name)
  let location = first(query.loc)
  let price = first(query.price)
  let period = first(query.period)
  let image = first(query.img)
  let description = ''
  let amenities: string[] = []
  let type = ''
  let hostName = first(query.merchant)
  let sellerImage = ''
  let shopId = ''
  let gallery: string[] = []

  description =
    first(query.desc) || first(query.description) || description

  if (kind === 'accommodation' && id) {
    const fetched = await fetchStayById(id)
    if (fetched) {
      const { stay } = fetched
      name = stay.name || name
      location = stay.location && stay.location !== '—' ? stay.location : location
      if (stay.price > 0) price = String(stay.price)
      period = periodSuffix(stay.pricingPeriod)
      const cover = (stay.image || '').trim()
      image = resolveVeroMediaUrl(cover) || ''
      gallery = stay.gallery
        .map(src => src.trim())
        .filter(src => src && src !== cover)
        .map(src => resolveVeroMediaUrl(src) || '')
        .filter(Boolean)
      description = stay.description || ''
      amenities = fetched.amenities
      type = stay.accommodationType || ''
      hostName = stay.hostName || hostName
    }
  }

  if (kind === 'marketplace' && id) {
    period = ''
    const product = await fetchMarketplaceProductById(id)
    if (product) {
      name = product.name || name
      location = product.location && product.location !== '—' ? product.location : location
      if (product.price > 0) price = String(Math.round(product.price))
      const cover = (product.image || '').trim()
      image = resolveVeroMediaUrl(cover) || ''
      gallery = product.gallery
        .map(src => src.trim())
        .filter(src => src && src !== cover)
        .map(src => resolveVeroMediaUrl(src) || '')
        .filter(Boolean)
      description = product.description || description
      type = product.category || 'Product'
      hostName = product.merchantName || hostName
      if (product.merchantFirebaseUid) {
        shopId = product.merchantFirebaseUid
        const seller = await fetchShopById(product.merchantFirebaseUid)
        if (seller?.image) {
          sellerImage = resolveVeroMediaUrl(seller.image) || ''
        }
        if (!hostName && seller?.name) hostName = seller.name
      }
    }
  }

  if (kind === 'shop' && id) {
    period = ''
    const shop = await fetchShopById(id)
    if (shop) {
      name = shop.name || name
      location = shop.location || location
      description = shop.description || ''
      type = 'Merchant shop'
      const cover = (shop.image || '').trim()
      image = resolveVeroMediaUrl(cover) || image
    }
  }

  if (!name) name = first(query.q)
  if (kind === 'marketplace' || kind === 'shop') period = ''
  if (!image && gallery[0]) {
    image = gallery[0]
    gallery = gallery.slice(1)
  }
  if (image) image = resolveVeroMediaUrl(image) || image

  const appPath = appPathForKind(kind)
  const defaultTitle =
    kind === 'shop'
      ? 'Shop on Vero360'
      : kind === 'marketplace'
        ? 'Product on Vero360'
        : 'Stay on Vero360'
  const title = name || defaultTitle
  const subtitle =
    [location, description].filter(Boolean).join(' · ') ||
    (kind === 'shop'
      ? 'Browse this shop in the Vero360 app, or view it here.'
      : kind === 'marketplace'
        ? 'Open this product in the Vero360 app, or view it here.'
        : 'Open this stay in the Vero360 app, or view it here.')

  return {
    kind,
    id,
    name,
    location,
    price,
    period,
    image,
    gallery,
    description,
    amenities,
    type,
    hostName,
    sellerImage,
    shopId,
    appHref: `vero360://${appPath}${id ? `/${id}` : ''}`,
    title,
    subtitle,
  }
}

export async function listingMetadata(
  kind: ListingKind,
  props: ListingPageProps,
): Promise<Metadata> {
  const listing = await listingFromProps(kind, props)
  const path =
    kind === 'shop'
      ? `/shop/${listing.id}`
      : kind === 'marketplace'
        ? `/marketplace/${listing.id}`
        : `/accommodation/${listing.id}`
  const imageOk =
    listing.image.startsWith('http') || listing.image.startsWith('/api/media')

  return {
    title: `${listing.title} · Vero360`,
    description: listing.subtitle,
    openGraph: {
      title: listing.title,
      description: listing.subtitle,
      url: `https://vero360.app${path}`,
      siteName: 'Vero360',
      type: 'website',
      images: imageOk ? [{ url: listing.image }] : undefined,
    },
  }
}

