import { NextResponse } from 'next/server'
import { enrichOrderContacts } from '@/lib/order-contacts'
import { enrichOrderDelivery } from '@/lib/order-delivery'
import { isOrderStatus, parseMarketplaceOrders } from '@/lib/orders'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status =
    body && typeof body === 'object' && 'status' in body
      ? String((body as { status: unknown }).status || '').toLowerCase()
      : ''

  if (!isOrderStatus(status)) {
    return NextResponse.json(
      { error: 'status must be pending, confirmed, delivered, or cancelled' },
      { status: 400 },
    )
  }

  try {
    const headers: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    const auth = getVeroAuthHeader(request)
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('orders', 'admin', id, 'status'), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ Status: status }),
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to update order status') },
        { status: res.status },
      )
    }

    const [item] = parseMarketplaceOrders([data])
    let enriched = item
    if (item) {
      try {
        ;[enriched] = await enrichOrderContacts([item])
        ;[enriched] = await enrichOrderDelivery([enriched])
      } catch {
        // keep parsed item
      }
    }
    return NextResponse.json({ success: true, item: enriched || data })
  } catch (err) {
    console.error('Admin order status PATCH error:', err)
    return NextResponse.json({ error: 'Could not update order status' }, { status: 502 })
  }
}
