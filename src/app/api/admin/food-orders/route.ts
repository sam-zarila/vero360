import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import { parseFoodAdminOrder } from '@/lib/food-orders-admin'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const db = getAdminDb()
    let snap
    try {
      snap = await db
        .collection('food_orders')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
    } catch {
      snap = await db.collection('food_orders').limit(200).get()
    }

    const items = snap.docs
      .map(doc => parseFoodAdminOrder(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })

    const counts = {
      all: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      preparing: items.filter(i => i.status === 'preparing').length,
      sent: items.filter(i => i.status === 'sent' || i.status === 'ready').length,
      delivered: items.filter(i => i.status === 'delivered').length,
      cancelled: items.filter(i => i.status === 'cancelled').length,
    }

    return NextResponse.json({ success: true, items, counts })
  } catch (err) {
    console.error('Admin food orders GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load food orders' },
      { status: 500 },
    )
  }
}
