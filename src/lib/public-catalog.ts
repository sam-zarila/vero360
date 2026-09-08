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

function clampLimit(raw: number | undefined, fallback = 8) {
  if (!Number.isFinite(raw as number)) return fallback
  return Math.min(Math.max(Math.floor(raw as number), 1), 24)
}

function media(url: string | null | undefined) {
  if (!url) return null
  return resolveVeroMediaUrl(url) || url
}

function marketplaceHref(item: MarketplaceListing) {
  if (item.firestoreDocId) return `/marketplace/${item.firestoreDocId}`
  if (item.sqlId) return `/marketplace/${item.sqlId}`
  const fromKey = item.key.replace(/^api:/, '')
  return fromKey ? `/marketplace/${fromKey}` : null
}

function foodHref(item: FoodItem) {
  return item.rawId ? `/food/${item.rawId}` : null
}

async function loadMarketplaceRaw(): Promise<MarketplaceListing[]> {
  let firestoreItems: MarketplaceListing[] = []
  try {
    const snap = await getAdminDb()
      .collection(MARKETPLACE_ITEMS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(80)
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
        .limit(80)
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

  let apiItems: MarketplaceListing[] = []
  try {
    const res = await fetch(veroEndpoint('marketplace'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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
export async function listPublicMarketplace(limit = 8): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const items = (await loadMarketplaceRaw())
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
      href: marketplaceHref(item),
      externalUrl: null,
    }))
  } catch (err) {
    console.warn('listPublicMarketplace:', err)
    return []
  }
}

export async function listPublicFood(limit = 8): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const apiUrl = new URL(veroEndpoint('marketplace'))
    apiUrl.searchParams.set('category', 'food')

    const [apiRes, marketplaceSnap, menuSnap] = await Promise.all([
      fetch(apiUrl.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }).catch(() => null),
      getAdminDb()
        .collection('marketplace_items')
        .where('category', '==', 'food')
        .limit(60)
        .get()
        .catch(() => null),
      getAdminDb().collection('food_menu_items').limit(60).get().catch(() => null),
    ])

    let apiItems: FoodItem[] = []
    if (apiRes) {
      const body = await readJsonSafe(apiRes)
      if (apiRes.ok) apiItems = parseApiFoodItems(body)
    }

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

export async function listPublicStays(limit = 8): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const res = await fetch(veroEndpoint('accommodations', 'all'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      console.warn('Public stays API:', apiErrorMessage(body, 'failed'))
      return []
    }

    let items: StayListing[] = parseStayListings(body)
    try {
      items = await enrichStayListings(items)
    } catch {
      // enrichment optional
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

export async function listPublicJobs(limit = 8): Promise<PublicCatalogCard[]> {
  const take = clampLimit(limit)
  try {
    const qs = new URLSearchParams({ activeOnly: 'true' })
    const res = await fetch(`${veroEndpoint('jobs')}?${qs.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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

export async function listPublicTenderCards(limit = 8): Promise<PublicCatalogCard[]> {
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
