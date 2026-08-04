import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  REFUND_REQUESTS_COLLECTION,
  countRefunds,
  parseRefundRequest,
} from '@/lib/refunds'

export async function GET() {
  try {
    const db = getAdminDb()
    let snap
    try {
      snap = await db
        .collection(REFUND_REQUESTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .get()
    } catch {
      snap = await db.collection(REFUND_REQUESTS_COLLECTION).get()
    }

    const items = snap.docs
      .map(doc => parseRefundRequest(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })

    return NextResponse.json({
      success: true,
      items,
      counts: countRefunds(items),
    })
  } catch (err) {
    console.error('Admin refunds GET error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not load refund requests from Firestore',
      },
      { status: 502 },
    )
  }
}
