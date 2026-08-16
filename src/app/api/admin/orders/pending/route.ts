import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
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
          error: apiErrorMessage(body, 'Failed to load pending orders'),
        },
        { status: res.status },
      )
    }

    const pending = parseMarketplaceOrders(body)
      .filter(item => item.status === 'pending')
      .sort((a, b) => {
        const at = a.orderDate ? new Date(a.orderDate).getTime() : 0
        const bt = b.orderDate ? new Date(b.orderDate).getTime() : 0
        return bt - at
      })

    return NextResponse.json({
      success: true,
      pending: pending.length,
      pendingIds: pending.map(item => item.id),
      latest: pending[0]
        ? {
            id: pending[0].id,
            orderNumber: pending[0].orderNumber,
            itemName: pending[0].itemName,
            orderDate: pending[0].orderDate,
          }
        : null,
    })
  } catch (err) {
    console.error('Admin orders pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach orders API' }, { status: 502 })
  }
}
