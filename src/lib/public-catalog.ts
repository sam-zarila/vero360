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

function clampLimit(raw: number | undefined, fallback = 500) {
  if (!Number.isFinite(raw as number)) return fallback
  return Math.min(Math.max(Math.floor(raw as number), 1), 500)
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

async function loadMarketplaceRaw(limit = 500): Promise<MarketplaceListing[]> {
  const take = clampLimit(limit)
  const previewOnly = take <= 48

  let firestoreItems: MarketplaceListing[] = []
  try {
    const snap = await getAdminDb()
      .collection(MARKETPLACE_ITEMS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(take)
      .get()
    firestoreItems = snap.docs
      .map(doc =>
        parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>),
      )
      .filter((item): item is MarketplaceListing => !!item)
  } catch {
    try {
      const snap = await getAdminDb()
        .collection(MARKETPLACE_ITEMS_COLLECTION)
        .limit(take)
        .get()
      firestoreItems = snap.docs
        .map(doc =>
          parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>),
        )
        .filter((item): item is MarketplaceListing => !!item)
    } catch (err) {
      console.warn('Public marketplace Firestore:', err)
    }
  }

  // Landing previews: Firestore is enough — skip slow Nest round-trip.
  if (previewOnly && firestoreItems.length >= Math.min(take, 8)) {
    return firestoreItems.sort((a, b) => {
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
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at
  })
}

/** Main marketplace browse — excludes food (food strip owns those). */
export async function listPublicMarketplace(limit = 500): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
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
      .slice(0, take)
      .map(p => {
        const isSub =
          p.category === 'streaming' || p.category === 'subscription'
        const fixed =
          typeof p.fixedMwkPrice === 'number' && p.fixedMwkPrice > 0
            ? Math.round(p.fixedMwkPrice)
            : null
        const fromUsd =
          Array.isArray(p.usdAmounts) && p.usdAmounts.length > 0
            ? Math.round(Number(p.usdAmounts[0]) * rate)
            : null
        const price = isSub ? fixed : fixed ?? fromUsd
        const amounts =
          Array.isArray(p.usdAmounts) && p.usdAmounts.length
            ? `From $${p.usdAmounts[0]}`
            : null
        const metaParts = [
          digitalCategoryLabel(p.category),
          p.brandTag || null,
          !isSub && amounts ? amounts : p.subtitle || null,
        ].filter(Boolean)

        return {
          id: p.key,
          title: p.name,
          image: digitalBrandImage(p.key),
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
