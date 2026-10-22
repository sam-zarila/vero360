import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'
import {
  MARKETPLACE_ITEMS_COLLECTION,
  mergeMarketplaceListings,
  parseFirestoreMarketplaceListing,
  parseMarketplaceListings,
  type MarketplaceListing,
} from '@/lib/marketplace'
import {
  mergeFoodItems,
  parseApiFoodItems,
  parseFirestoreMarketplaceFood,
  parseFirestoreMenuFood,
  type FoodItem,
} from '@/lib/food'
import { parseStayListings, type StayListing } from '@/lib/stay'
import { enrichStayListings } from '@/lib/stay-rooms'
import { parseJobPosts, type JobPost } from '@/lib/jobs'
import { listPublicTenders } from '@/lib/tenders-admin'
import type { Tender } from '@/lib/tenders'
import {
  apiErrorMessage,
  readJsonSafe,
  resolveVeroMediaUrl,
  veroEndpoint,
} from '@/lib/vero-api'
import { digitalBrandImage } from '@/lib/digital-brand-images'
import {
  carSubtitle,
  carTitle,
  isPublicCar,
  parseCar,
  parseCarListings,
  resolveCarImage,
  type CarListing,
} from '@/lib/car-hire'

export type PublicCatalogCard = {
  id: string
  title: string
  image: string | null
  price: number | null
  location: string | null
  meta: string | null
  href: string | null
  externalUrl: string | null
}

function clampLimit(raw: number | undefined, fallback = 500, max = 2000) {
  if (!Number.isFinite(raw as number)) return fallback
  return Math.min(Math.max(Math.floor(raw as number), 1), max)
}

function media(url: string | null | undefined) {
  if (!url) return null
  return resolveVeroMediaUrl(url) || url
}

function marketplaceHref(item: MarketplaceListing) {
  if (item.firestoreDocId) return `/marketplace/${item.firestoreDocId}`
  if (item.sqlId) return `/marketplace/${item.sqlId}`
  const fromKey = item.key.replace(/^api:/, '').trim()
  if (fromKey) return `/marketplace/${fromKey}`
  return null
}

function foodHref(item: FoodItem) {
  return item.rawId ? `/food/${item.rawId}` : null
}

async function loadMarketplaceRaw(limit = 2000): Promise<MarketplaceListing[]> {
  const take = clampLimit(limit, 2000, 2000)
  const previewOnly = take <= 48

  const byId = new Map<string, MarketplaceListing>()

  const ingestDocs = (
    docs: Array<{ id: string; data: () => Record<string, unknown> }>,
  ) => {
    for (const doc of docs) {
      const item = parseFirestoreMarketplaceListing(doc.id, doc.data())
      if (item) byId.set(doc.id, item)
    }
  }

  try {
    // Newest first (docs with createdAt).
    const snap = await getAdminDb()
      .collection(MARKETPLACE_ITEMS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(take)
      .get()
    ingestDocs(snap.docs)
  } catch {
    // fall through to unordered fetch
  }

  // Fill gaps: orderBy(createdAt) skips docs missing createdAt.
  if (byId.size < take) {
    try {
      const snap = await getAdminDb()
        .collection(MARKETPLACE_ITEMS_COLLECTION)
        .limit(take)
        .get()
      ingestDocs(snap.docs)
    } catch (err) {
      console.warn('Public marketplace Firestore:', err)
    }
  }

  const firestoreItems = [...byId.values()]

  // Landing previews: Firestore is enough — skip slow Nest round-trip.
  if (previewOnly && firestoreItems.length >= Math.min(take, 8)) {
    return firestoreItems.sort((a, b) => {
      const now = Date.now()
      const aPromo = a.promotedUntil ? new Date(a.promotedUntil).getTime() : 0
      const bPromo = b.promotedUntil ? new Date(b.promotedUntil).getTime() : 0
      const aLive = aPromo > now ? 1 : 0
      const bLive = bPromo > now ? 1 : 0
      if (aLive !== bLive) return bLive - aLive
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })
  }

  let apiItems: MarketplaceListing[] = []
  try {
    const res = await fetch(veroEndpoint('marketplace'), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })
    const body = await readJsonSafe(res)
    if (res.ok) apiItems = parseMarketplaceListings(body)
    else console.warn('Public marketplace API:', apiErrorMessage(body, 'failed'))
  } catch (err) {
    console.warn('Public marketplace API unreachable:', err)
  }

  return mergeMarketplaceListings(firestoreItems, apiItems).sort((a, b) => {
    const now = Date.now()
    const aPromo = a.promotedUntil ? new Date(a.promotedUntil).getTime() : 0
    const bPromo = b.promotedUntil ? new Date(b.promotedUntil).getTime() : 0
    const aLive = aPromo > now ? 1 : 0
    const bLive = bPromo > now ? 1 : 0
    if (aLive !== bLive) return bLive - aLive
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at
  })
}

/** Main marketplace browse — excludes food (food strip owns those). */
export async function listPublicMarketplace(limit = 2000): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit, 2000, 2000)
  try {
    const items = (await loadMarketplaceRaw(take))
      .filter(i => i.isActive !== false)
      .filter(i => String(i.category).toLowerCase() !== 'food')
      .slice(0, take)

    return items.map(item => ({
      id: item.firestoreDocId || String(item.sqlId || item.key),
      title: item.name,
      image: media(item.image),
      price: item.price > 0 ? item.price : null,
      location: item.location && item.location !== '—' ? item.location : null,
      meta: item.category || null,
      href:
        marketplaceHref(item) ||
        `/marketplace/${item.firestoreDocId || item.sqlId || item.key.replace(/^api:/, '')}`,
      externalUrl: null,
    }))
  } catch (err) {
    console.warn('listPublicMarketplace:', err)
    return []
  }
}

export async function listPublicFood(limit = 500): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  const previewOnly = take <= 48
  try {
    const [marketplaceSnap, menuSnap] = await Promise.all([
      getAdminDb()
        .collection('marketplace_items')
        .where('category', '==', 'food')
        .limit(take)
        .get()
        .catch(() => null),
      getAdminDb().collection('food_menu_items').limit(take).get().catch(() => null),
    ])

    const marketplaceItems =
      marketplaceSnap?.docs
        .map(doc =>
          parseFirestoreMarketplaceFood(doc.id, doc.data() as Record<string, unknown>),
        )
        .filter((item): item is FoodItem => !!item) ?? []

    const menuItems =
      menuSnap?.docs
        .map(doc => parseFirestoreMenuFood(doc.id, doc.data() as Record<string, unknown>))
        .filter((item): item is FoodItem => !!item) ?? []

    let apiItems: FoodItem[] = []
    const firestoreCount = marketplaceItems.length + menuItems.length
    if (!previewOnly || firestoreCount < Math.min(take, 8)) {
      const apiUrl = new URL(veroEndpoint('marketplace'))
      apiUrl.searchParams.set('category', 'food')
      const apiRes = await fetch(apiUrl.toString(), {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      }).catch(() => null)
      if (apiRes) {
        const body = await readJsonSafe(apiRes)
        if (apiRes.ok) apiItems = parseApiFoodItems(body)
      }
    }

    const items = mergeFoodItems([apiItems, marketplaceItems, menuItems])
      .filter(i => i.available !== false)
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
      .slice(0, take)

    return items.map(item => ({
      id: item.rawId,
      title: item.name,
      image: media(item.image),
      price: item.price > 0 ? item.price : null,
      location: item.location,
      meta: item.restaurant || null,
      href: foodHref(item),
      externalUrl: null,
    }))
  } catch (err) {
    console.warn('listPublicFood:', err)
    return []
  }
}

export async function listPublicStays(limit = 500): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const res = await fetch(veroEndpoint('accommodations', 'all'), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      console.warn('Public stays API:', apiErrorMessage(body, 'failed'))
      return []
    }

    let items: StayListing[] = parseStayListings(body)
    // Skip room enrichment on small preview requests — big latency win.
    if (take > 36) {
      try {
        items = await enrichStayListings(items)
      } catch {
        // enrichment optional
      }
    }

    return items
      .filter(i => i.isAvailable !== false)
      .slice(0, take)
      .map(item => ({
        id: String(item.id),
        title: item.name,
        image: media(item.image),
        price: item.price > 0 ? item.price : null,
        location: item.location && item.location !== '—' ? item.location : null,
        meta: item.accommodationType ? String(item.accommodationType) : null,
        href: `/accommodation/${item.id}`,
        externalUrl: null,
      }))
  } catch (err) {
    console.warn('listPublicStays:', err)
    return []
  }
}

export async function listPublicJobs(limit = 500): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const qs = new URLSearchParams({ activeOnly: 'true' })
    const res = await fetch(`${veroEndpoint('jobs')}?${qs.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      console.warn('Public jobs API:', apiErrorMessage(body, 'failed'))
      return []
    }

    const items: JobPost[] = parseJobPosts(body)
      .filter(j => j.isActive)
      .slice(0, take)

    return items.map(item => ({
      id: String(item.id),
      title: item.position,
      image: media(item.photoUrl),
      price: null,
      location: item.isRemote ? 'Remote' : item.location,
      meta: item.company,
      href: null,
      externalUrl: item.jobLink || null,
    }))
  } catch (err) {
    console.warn('listPublicJobs:', err)
    return []
  }
}

export async function listPublicTenderCards(limit = 500): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const items: Tender[] = await listPublicTenders(take)
    return items.map(item => ({
      id: item.id,
      title: item.title,
      image: null,
      price: null,
      location: item.location,
      meta: item.buyer,
      href: null,
      externalUrl: item.tenderUrl || item.documentUrl || null,
    }))
  } catch (err) {
    console.warn('listPublicTenderCards:', err)
    return []
  }
}

function digitalCategoryLabel(category: string): string {
  const c = category.trim().toLowerCase()
  if (c === 'streaming' || c === 'subscription') return 'Subscription'
  if (c === 'gaming') return 'Gaming'
  if (c === 'gift_cards') return 'Gift card'
  if (c === 'crypto') return 'Crypto / FX'
  return 'Digital'
}

/** Active digital products from Firestore `app_config/digital_services` (+ defaults). */
export async function listPublicDigitalServices(
  limit = 500,
): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const { getDigitalServicesConfig } = await import('@/lib/digital-services-config')
    const config = await getDigitalServicesConfig()
    const rate = Math.max(1, config.usdToMwkRate || 4700)

    return config.products
      .filter(p => p.active !== false)
      // Plans are chosen on the Netflix and ChatGPT pages, not as separate cards.
      .filter(p => !String(p.key || '').startsWith('netflix_'))
      .filter(p => p.key !== 'chatgpt_basic' && p.key !== 'chatgpt_plus')
      .slice(0, take)
      .map(p => {
        const isSub =
          p.category === 'streaming' || p.category === 'subscription'
        const isPlanHub = p.key === 'netflix' || p.key === 'chatgpt'
        const unitRate =
          typeof p.mwkPerUnit === 'number' && p.mwkPerUnit > 0
            ? p.mwkPerUnit
            : rate
        const fixed =
          typeof p.fixedMwkPrice === 'number' && p.fixedMwkPrice > 0
            ? Math.round(p.fixedMwkPrice)
            : null
        const fromUsd =
          Array.isArray(p.usdAmounts) && p.usdAmounts.length > 0
            ? Math.round(Number(p.usdAmounts[0]) * unitRate)
            : null
        const price = isPlanHub ? null : isSub ? fixed : fixed ?? fromUsd
        const unit = (p.unitLabel || '').trim()
        const amounts =
          Array.isArray(p.usdAmounts) && p.usdAmounts.length
            ? unit
              ? `From ${p.usdAmounts[0]} ${unit}`
              : `From $${p.usdAmounts[0]}`
            : null
        const metaParts = [
          digitalCategoryLabel(p.category),
          p.brandTag || null,
          isPlanHub
            ? 'Choose a plan'
            : !isSub && amounts
              ? amounts
              : p.subtitle || null,
        ].filter(Boolean)

        return {
          id: p.key,
          title: p.name,
          image: digitalBrandImage(p.key, p.imageUrl),
          price,
          location: null,
          meta: metaParts.join(' · ') || null,
          href: `/digital-services/${encodeURIComponent(p.key)}`,
          externalUrl: null,
        }
      })
  } catch (err) {
    console.warn('listPublicDigitalServices:', err)
    return []
  }
}

function carHireCard(car: CarListing): PublicCatalogCard {
  return {
    id: String(car.id),
    title: carTitle(car),
    image: media(resolveCarImage(car)),
    price: car.dailyRate > 0 ? car.dailyRate : null,
    location: car.pickupArea || car.location?.name || null,
    meta: carSubtitle(car),
    href: `/car-hire/${car.id}`,
    externalUrl: null,
  }
}

export async function listPublicCarHireFiltered(opts?: {
  limit?: number
  pickupArea?: string | null
  startAt?: string | null
  endAt?: string | null
}): Promise<PublicCatalogCard[]> {
  const take = clampLimit(opts?.limit, 120, 200)
  const pickupArea = (opts?.pickupArea || '').trim()
  const startAt = (opts?.startAt || '').trim()
  const endAt = (opts?.endAt || '').trim()
  const cars: CarListing[] = []

  try {
    let page = 1
    while (cars.length < take && page <= 6) {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('limit', String(Math.min(50, take - cars.length)))
      if (pickupArea) qs.set('pickupArea', pickupArea)
      if (startAt) qs.set('startAt', startAt)
      if (endAt) qs.set('endAt', endAt)

      const res = await fetch(`${veroEndpoint('car-rental', 'cars')}?${qs}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const body = await readJsonSafe(res)
      if (!res.ok) {
        console.warn('Public car hire API:', apiErrorMessage(body, 'failed'))
        break
      }

      const batch = parseCarListings(body).filter(isPublicCar)
      if (!batch.length) break
      cars.push(...batch)
      if (batch.length < 50) break
      page += 1
    }
  } catch (err) {
    console.warn('listPublicCarHireFiltered:', err)
  }

  const seen = new Set<number>()
  return cars
    .filter(car => {
      if (seen.has(car.id)) return false
      seen.add(car.id)
      return true
    })
    .slice(0, take)
    .map(carHireCard)
}

export async function getPublicCarHireById(
  id: string,
  opts?: { startAt?: string | null; endAt?: string | null },
): Promise<CarListing | null> {
  const key = id.trim()
  if (!key) return null
  try {
    const qs = new URLSearchParams()
    const startAt = (opts?.startAt || '').trim()
    const endAt = (opts?.endAt || '').trim()
    if (startAt) qs.set('startAt', startAt)
    if (endAt) qs.set('endAt', endAt)
    const query = qs.toString()
    const url = query
      ? `${veroEndpoint('car-rental', 'cars', key)}?${query}`
      : veroEndpoint('car-rental', 'cars', key)
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      console.warn('Public car hire detail:', apiErrorMessage(body, 'failed'))
      return null
    }
    const car = parseCar(body) || parseCarListings(body)[0] || null
    if (!car || !isPublicCar(car)) return null
    return car
  } catch (err) {
    console.warn('getPublicCarHireById:', err)
    return null
  }
}
