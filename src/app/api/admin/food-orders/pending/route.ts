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
      snap = await db.collection('food_orders').orderBy('createdAt', 'desc').limit(80).get()
    } catch {
      snap = await db.collection('food_orders').limit(80).get()
    }

    const recent = snap.docs
      .map(doc => parseFoodAdminOrder(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
    const pending = recent.filter(item => item.status === 'pending' || item.status === 'preparing')
    const latest = recent[0] || null

    return NextResponse.json({
      success: true,
      pending: pending.length,
      pendingIds: pending.map(item => item.id),
      recentIds: recent.map(item => item.id),
      latest: latest
        ? {
            id: latest.id,
            orderNumber: latest.orderNumber,
            kitchen: latest.kitchen,
            customerName: latest.customerName,
            status: latest.status,
          }
        : null,
    })
  } catch (err) {
    console.error('Admin food orders pending GET error:', err)
    return NextResponse.json({ error: 'Could not load food orders' }, { status: 500 })
  }
}
