import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  MERCHANT_REPORTS_COLLECTION,
  normalizeMerchantReportStatus,
  parseMerchantReport,
} from '@/lib/merchant-reports'

/** Lightweight poll for admin badges / notifications. */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const db = getAdminDb()
    let snap
    try {
      snap = await db
        .collection(MERCHANT_REPORTS_COLLECTION)
        .where('status', '==', 'open')
        .get()
    } catch {
      snap = await db.collection(MERCHANT_REPORTS_COLLECTION).get()
    }

    const open = snap.docs
      .map(doc => parseMerchantReport(doc.id, doc.data() as Record<string, unknown>))
      .filter(item => normalizeMerchantReportStatus(item.status) === 'open')
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })

    const latest = open[0]

    return NextResponse.json({
      success: true,
      open: open.length,
      openIds: open.map(item => item.id),
      latest: latest
        ? {
            id: latest.id,
            merchantName: latest.merchantName,
            merchantId: latest.merchantId,
            reporterEmail: latest.reporterEmail,
            createdAt: latest.createdAt,
          }
        : null,
    })
  } catch (err) {
    console.error('Admin merchant reports open GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load open reports' },
      { status: 502 },
    )
  }
}
