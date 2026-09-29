import 'server-only'

import type { Metadata } from 'next'
import {
  ANDROID_PACKAGE_ID,
  appleAppStoreId,
  customSchemeHref,
} from '@/lib/app-links'
import { getAdminDb } from '@/lib/firebase-admin'
import { fetchPublicFoodById } from '@/lib/food'
import { parseFirestoreMarketplaceListing } from '@/lib/marketplace'
import type {
  ListingKind,
  ListingModel,
  ListingPageProps,
  ListingQuery,
} from '@/lib/open-listing-types'
import { parseStayListings, type StayListing } from '@/lib/stay'
import { ACCOMMODATION_ROOMS_COLLECTION } from '@/lib/stay-rooms'
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
  if (kind === 'food') return 'food'
  return 'accommodation'
}

type StayFetchResult = {
  stay: StayListing
  amenities: string[]
} | null

async function fetchStayByApiId(n: number): Promise<StayFetchResult> {
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

async function fetchStayById(id: string): Promise<StayFetchResult> {
  const n = Number(id)
  if (Number.isFinite(n) && n > 0) {
    const fromApi = await fetchStayByApiId(n)
    if (fromApi) return fromApi
  }

  // Facebook / Firestore room docs often use non-numeric ids (e.g. uid_123).
  try {
    const db = getAdminDb()
    let doc = await db.collection(ACCOMMODATION_ROOMS_COLLECTION).doc(id).get()
    if (!doc.exists) {
      doc = await db.collection('accommodations').doc(id).get()
    }
    if (doc.exists) {
      const data = (doc.data() || {}) as Record<string, unknown>
      const apiId =
        Number(data.accommodationId ?? data.sqlId ?? data.id ?? data.ID) ||
        (id.includes('_') ? Number(id.split('_').pop()) : 0)
      if (apiId > 0) {
        const nested = await fetchStayByApiId(apiId)
        if (nested) return nested
      }
      const name = str(data.name) || str(data.title) || 'Stay on Vero360'
      const price = num(data.price ?? data.pricePerNight)
      const image =
        str(data.image) ||
        str(data.imageUrl) ||
        str(data.coverImage) ||
        (Array.isArray(data.gallery) ? str(data.gallery[0]) : '')
      const stay: StayListing = {
        id: apiId > 0 ? apiId : 0,
        name,
        location: str(data.location) || '—',
        description: str(data.description) || null,
        price,
        accommodationType: str(data.accommodationType || data.type) || 'lodge',
        image: image || null,
        gallery: Array.isArray(data.gallery)
          ? data.gallery.map((x: unknown) => str(x)).filter(Boolean)
          : [],
        hostName: str(data.hostName || data.merchantName) || null,
        hostEmail: null,
        hostPhone: null,
        hostFirebaseUid: str(data.merchantId || data.hostFirebaseUid) || null,
        pricingPeriod: str(data.pricingPeriod || data.pricePeriod) || 'night',
        capacity: null,
        isAvailable: true,
        hostelGender: null,
        roomType: null,
      }
      return {
        stay,
        amenities: parseAmenities(data),
      }
    }
  } catch (err) {
    console.warn('Public stay Firestore fetch failed:', err)
  }

  return null
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

async function fetchMarketplaceProductById(id: string) {
  const headers = { Accept: 'application/json' }
  const sqlId = Number(id)

  // Prefer Firestore (fast path) before Nest — landing clicks feel snappier.
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
    console.warn('Public marketplace Firestore fetch failed:', err)
  }

  if (Number.isFinite(sqlId) && sqlId > 0) {
    try {
      const res = await fetch(veroEndpoint('marketplace', sqlId), {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
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
      // ignore Nest timeout / errors
    }
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
      image = resolveVeroMediaUrl(cover) || image
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
      image = resolveVeroMediaUrl(cover) || image
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

  if (kind === 'food' && id) {
    period = ''
    const dish = await fetchPublicFoodById(id)
    if (dish) {
      name = dish.name || name
      location = dish.location || location
      if (dish.price > 0) price = String(Math.round(dish.price))
      const cover = (dish.image || '').trim()
      image = resolveVeroMediaUrl(cover) || image
      gallery = dish.gallery
        .map(src => src.trim())
        .filter(src => src && src !== cover)
        .map(src => resolveVeroMediaUrl(src) || '')
        .filter(Boolean)
      description = dish.description || description
      type = dish.category || 'Food'
      hostName = dish.restaurant || hostName
      if (dish.merchantId) {
        shopId = dish.merchantId
        const seller = await fetchShopById(dish.merchantId)
        if (seller?.image) {
          sellerImage = resolveVeroMediaUrl(seller.image) || ''
        }
        if (!hostName && seller?.name) hostName = seller.name
      }
    }
  }

  if (!name) name = first(query.q)
  if (kind === 'marketplace' || kind === 'shop' || kind === 'food') period = ''
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
        : kind === 'food'
          ? 'Food on Vero360'
          : 'Stay on Vero360'
  const title = name || defaultTitle
  const subtitle =
    [location, description].filter(Boolean).join(' · ') ||
    (kind === 'shop'
      ? 'Browse this shop in the Vero360 app, or view it here.'
      : kind === 'marketplace'
        ? 'Open this product in the Vero360 app, or view it here.'
        : kind === 'food'
          ? 'Order this dish in the Vero360 app, or view it here.'
          : 'Open this stay in the Vero360 app, or view it here.')

  const webPath =
    kind === 'shop'
      ? `/shop/${id}`
      : kind === 'marketplace'
        ? `/marketplace/${id}`
        : kind === 'food'
          ? `/food/${id}`
          : `/accommodation/${id}`

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
    appHref: customSchemeHref(`${appPath}${id ? `/${id}` : ''}`),
    webUrl: `https://vero360.app${webPath}`,
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
        : kind === 'food'
          ? `/food/${listing.id}`
          : `/accommodation/${listing.id}`

  const rawImage = (listing.image || '').trim()
  let imageUrl = ''
  if (/^https?:\/\//i.test(rawImage)) {
    imageUrl = rawImage.replace(/^http:\/\//i, 'https://')
  } else if (rawImage.startsWith('/')) {
    imageUrl = `https://vero360.app${rawImage}`
  }

  const canonical = `https://vero360.app${path}`
  const storeId = appleAppStoreId()

  const other: Record<string, string> = {
    // Facebook App Links — prefer native app when installed.
    'al:android:url': listing.appHref,
    'al:android:package': ANDROID_PACKAGE_ID,
    'al:android:app_name': 'Vero360',
    'al:ios:url': listing.appHref,
    'al:ios:app_name': 'Vero360',
    'al:web:url': canonical,
    'al:web:should_fallback': 'true',
  }
  if (storeId) {
    other['al:ios:app_store_id'] = storeId
    other['apple-itunes-app'] = `app-id=${storeId}, app-argument=${canonical}`
  }

  return {
    title: `${listing.title} · Vero360`,
    description: listing.subtitle,
    alternates: { canonical },
    openGraph: {
      title: listing.title,
      description: listing.subtitle,
      url: canonical,
      siteName: 'Vero360',
      type: 'website',
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: listing.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.title,
      description: listing.subtitle,
      images: imageUrl ? [imageUrl] : undefined,
    },
    other,
  }
}

