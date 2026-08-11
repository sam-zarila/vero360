import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { enrichMerchantReports } from '@/lib/enrich-merchant-reports'
import {
  MERCHANT_REPORTS_COLLECTION,
  isMerchantReportStatus,
  parseMerchantReport,
} from '@/lib/merchant-reports'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
  }

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

  if (!isMerchantReportStatus(status)) {
    return NextResponse.json(
      {
        error: 'status must be open, in_review, resolved, or dismissed',
      },
      { status: 400 },
    )
  }

  try {
    const ref = getAdminDb().collection(MERCHANT_REPORTS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (status === 'resolved' || status === 'dismissed') {
      patch.resolvedAt = FieldValue.serverTimestamp()
    }

    await ref.update(patch)
    const updated = await ref.get()
    let item = parseMerchantReport(updated.id, updated.data() as Record<string, unknown>)
    try {
      ;[item] = await enrichMerchantReports([item])
    } catch (err) {
      console.warn('Merchant report enrich after PATCH skipped:', err)
    }

    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin merchant report PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update report' },
      { status: 502 },
    )
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
  }

  try {
    const ref = getAdminDb().collection(MERCHANT_REPORTS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    await ref.delete()
    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error('Admin merchant report DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete report' },
      { status: 502 },
    )
  }
}
