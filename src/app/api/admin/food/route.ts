import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  mergeFoodItems,
  parseApiFoodItems,
  parseFirestoreMarketplaceFood,
  parseFirestoreMenuFood,
} from '@/lib/food'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
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
        .limit(200)
        .get()
        .catch(() => null),
      getAdminDb()
        .collection('food_menu_items')
        .limit(200)
        .get()
        .catch(() => null),
    ])

    let apiItems = [] as ReturnType<typeof parseApiFoodItems>
    if (apiRes) {
      const body = await readJsonSafe(apiRes)
      if (apiRes.ok) {
        apiItems = parseApiFoodItems(body)
      } else {
        console.warn('Food marketplace API:', apiErrorMessage(body, 'failed'))
      }
    }

    const marketplaceItems =
      marketplaceSnap?.docs
        .map(doc => parseFirestoreMarketplaceFood(doc.id, doc.data() as Record<string, unknown>))
        .filter((item): item is NonNullable<typeof item> => !!item) ?? []

    const menuItems =
      menuSnap?.docs
        .map(doc => parseFirestoreMenuFood(doc.id, doc.data() as Record<string, unknown>))
        .filter((item): item is NonNullable<typeof item> => !!item) ?? []

    const items = mergeFoodItems([apiItems, marketplaceItems, menuItems]).sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        api: apiItems.length,
        marketplace: marketplaceItems.length,
        menu: menuItems.length,
      },
    })
  } catch (err) {
    console.error('Admin food GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load food items' },
      { status: 502 },
    )
  }
}
