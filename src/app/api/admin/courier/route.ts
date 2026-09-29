import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { parseCourierDeliveries } from '@/lib/courier'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const res = await fetch(veroEndpoint('verocourier', 'all', 'deliveries'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load courier deliveries') },
        { status: res.status },
      )
    }

    const items = parseCourierDeliveries(body).sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    const counts = {
      all: items.length,
      pending: items.filter(i => i.status === 'PENDING').length,
      accepted: items.filter(i => i.status === 'ACCEPTED').length,
      onTheWay: items.filter(i => i.status === 'ON_THE_WAY').length,
      delivered: items.filter(i => i.status === 'DELIVERED').length,
      cancelled: items.filter(i => i.status === 'CANCELLED').length,
    }

    return NextResponse.json({ success: true, items, counts })
  } catch (err) {
    console.error('Admin courier GET error:', err)
    return NextResponse.json({ error: 'Could not reach courier API' }, { status: 502 })
  }
}
