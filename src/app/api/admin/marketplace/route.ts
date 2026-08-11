import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  cleanContactEmail,
  cleanContactPhone,
} from '@/lib/orders'
import {
  MARKETPLACE_ITEMS_COLLECTION,
  countByCategory,
  mergeMarketplaceListings,
  parseFirestoreMarketplaceListing,
  parseMarketplaceListings,
  type MarketplaceListing,
} from '@/lib/marketplace'
import { USERS_COLLECTION } from '@/lib/users'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

async function loadContact(uid: string) {
  const clean = uid.trim()
  if (!clean) return null
  let name: string | null = null
  let phone: string | null = null
  let email: string | null = null
  try {
    const snap = await getAdminDb().collection(USERS_COLLECTION).doc(clean).get()
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>
      name = str(d.name) || str(d.displayName) || str(d.businessName) || null
      phone = cleanContactPhone(str(d.phone) || str(d.phoneNumber))
      email = cleanContactEmail(str(d.contactEmail) || str(d.email))
    }
  } catch {
    // ignore
  }
  try {
    const user = await getAdminAuth().getUser(clean)
    name = name || str(user.displayName) || null
    phone = phone || cleanContactPhone(user.phoneNumber)
    email = email || cleanContactEmail(user.email)
  } catch {
    // ignore
  }
  if (!name && !phone && !email) return null
  return { name, phone, email }
}

async function enrichMerchants(items: MarketplaceListing[]): Promise<MarketplaceListing[]> {
  const uids = [
    ...new Set(
      items
        .map(i => i.merchantFirebaseUid)
        .filter((u): u is string => !!u && !u.startsWith('+') && u.length > 8),
    ),
  ]
  if (!uids.length) return items

  const cache = new Map<string, Awaited<ReturnType<typeof loadContact>>>()
  await Promise.all(
    uids.map(async uid => {
      cache.set(uid, await loadContact(uid))
    }),
  )

  return items.map(item => {
    if (!item.merchantFirebaseUid) return item
    const c = cache.get(item.merchantFirebaseUid)
    if (!c) return item
    return {
      ...item,
      merchantName: item.merchantName || c.name,
      merchantPhone: item.merchantPhone || c.phone,
      merchantEmail: item.merchantEmail || c.email,
    }
  })
}

/**
 * Primary: Firestore `marketplace_items` (same as Flutter MarketplaceService).
 * Secondary: Nest GET /marketplace for any SQL-only leftovers.
 */
export async function GET() {
  try {
    let firestoreItems: MarketplaceListing[] = []
    let firestoreError = ''

    try {
      const snap = await getAdminDb()
        .collection(MARKETPLACE_ITEMS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .get()
      firestoreItems = snap.docs
        .map(doc =>
          parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>),
        )
        .filter((item): item is MarketplaceListing => !!item)
    } catch (err) {
      firestoreError = err instanceof Error ? err.message : 'Firestore read failed'
      console.warn('Marketplace Firestore load failed:', err)
      // Fallback without orderBy if index/missing createdAt
      try {
        const snap = await getAdminDb().collection(MARKETPLACE_ITEMS_COLLECTION).get()
        firestoreItems = snap.docs
          .map(doc =>
            parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>),
          )
          .filter((item): item is MarketplaceListing => !!item)
        firestoreError = ''
      } catch (err2) {
        console.warn('Marketplace Firestore fallback failed:', err2)
      }
    }

    let apiItems: MarketplaceListing[] = []
    try {
      const res = await fetch(veroEndpoint('marketplace'), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const body = await readJsonSafe(res)
      if (res.ok) {
        apiItems = parseMarketplaceListings(body)
      } else {
        console.warn('Marketplace API:', apiErrorMessage(body, 'failed'))
      }
    } catch (err) {
      console.warn('Marketplace API unreachable:', err)
    }

    if (!firestoreItems.length && !apiItems.length) {
      return NextResponse.json(
        {
          error:
            firestoreError ||
            'No marketplace listings found in Firestore or API. Check Firebase Admin config.',
        },
        { status: 502 },
      )
    }

    let items = mergeMarketplaceListings(firestoreItems, apiItems).sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    try {
      items = await enrichMerchants(items)
    } catch (err) {
      console.warn('Marketplace merchant enrichment skipped:', err)
    }

    return NextResponse.json({
      success: true,
      items,
      counts: countByCategory(items),
      sources: {
        firestore: firestoreItems.length,
        api: apiItems.length,
      },
    })
  } catch (err) {
    console.error('Admin marketplace GET error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not load marketplace listings',
      },
      { status: 502 },
    )
  }
}
