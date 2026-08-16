import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { enrichOrderContacts } from '@/lib/order-contacts'
import { enrichOrderDelivery } from '@/lib/order-delivery'
import { parseMarketplaceOrders } from '@/lib/orders'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const res = await fetch(veroEndpoint('orders', 'admin', 'all'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        {
          error: apiErrorMessage(
            body,
            'Failed to load orders. Redeploy vero-backend with GET /orders/admin/all if this is 404.',
          ),
        },
        { status: res.status },
      )
    }

    const parsed = parseMarketplaceOrders(body).sort((a, b) => {
      const at = a.orderDate ? new Date(a.orderDate).getTime() : 0
      const bt = b.orderDate ? new Date(b.orderDate).getTime() : 0
      return bt - at
    })

    let items = parsed
    try {
      items = await enrichOrderContacts(items)
    } catch (err) {
      console.warn('Order contact enrichment skipped:', err)
    }
    try {
      items = await enrichOrderDelivery(items)
    } catch (err) {
      console.warn('Order delivery enrichment skipped:', err)
    }

    const counts = {
      all: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      confirmed: items.filter(i => i.status === 'confirmed').length,
      delivered: items.filter(i => i.status === 'delivered').length,
      cancelled: items.filter(i => i.status === 'cancelled').length,
    }

    return NextResponse.json({ success: true, items, counts })
  } catch (err) {
    console.error('Admin orders GET error:', err)
    return NextResponse.json({ error: 'Could not reach orders API' }, { status: 502 })
  }
}
