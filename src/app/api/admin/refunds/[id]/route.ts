import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  REFUND_REQUESTS_COLLECTION,
  isRefundStatus,
  parseRefundRequest,
} from '@/lib/refunds'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid refund id' }, { status: 400 })
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

  if (!isRefundStatus(status)) {
    return NextResponse.json(
      {
        error:
          'status must be pending, processing, completed, failed, or rejected',
      },
      { status: 400 },
    )
  }

  try {
    const ref = getAdminDb().collection(REFUND_REQUESTS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (status === 'completed') {
      patch.completedAt = FieldValue.serverTimestamp()
    }

    await ref.update(patch)
    const updated = await ref.get()
    const item = parseRefundRequest(updated.id, updated.data() as Record<string, unknown>)

    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin refund PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update refund' },
      { status: 502 },
    )
  }
}
