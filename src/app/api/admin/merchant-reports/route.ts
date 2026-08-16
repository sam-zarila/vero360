import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import { enrichMerchantReports } from '@/lib/enrich-merchant-reports'
import {
  MERCHANT_REPORTS_COLLECTION,
  countMerchantReports,
  parseMerchantReport,
} from '@/lib/merchant-reports'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const db = getAdminDb()
    let snap
    try {
      snap = await db
        .collection(MERCHANT_REPORTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .get()
    } catch {
      snap = await db.collection(MERCHANT_REPORTS_COLLECTION).get()
    }

    let items = snap.docs
      .map(doc => parseMerchantReport(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })

    try {
      items = await enrichMerchantReports(items)
    } catch (err) {
      console.warn('Merchant report enrichment skipped:', err)
    }

    return NextResponse.json({
      success: true,
      items,
      counts: countMerchantReports(items),
    })
  } catch (err) {
    console.error('Admin merchant reports GET error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not load merchant reports from Firestore',
      },
      { status: 502 },
    )
  }
}
