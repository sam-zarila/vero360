import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole } from '@/lib/admins'
import {
  BANK_TRANSFER_PAYMENTS_COLLECTION,
  parseBankTransferPayment,
} from '@/lib/bank-transfer-payments'
import { updateDigitalServiceOrderStatus } from '@/lib/digital-services-admin'
import { getAdminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor
  try {
    actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const clean = String(id || '').trim()
  if (!clean) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: { status?: string } = {}
  try {
    body = (await request.json()) as { status?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const next = String(body.status || '').trim().toLowerCase()
  if (next !== 'confirmed' && next !== 'rejected' && next !== 'pending_review') {
    return NextResponse.json(
      { error: 'Status must be confirmed, rejected, or pending_review' },
      { status: 400 },
    )
  }

  try {
    const ref = getAdminDb().collection(BANK_TRANSFER_PAYMENTS_COLLECTION).doc(clean)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updates: Record<string, unknown> = {
      status: next,
      updatedAt: FieldValue.serverTimestamp(),
      reviewedByEmail: actor.admin.email || actor.uid,
    }
    if (next === 'confirmed') {
      updates.confirmedAt = FieldValue.serverTimestamp()
    }
    if (next === 'rejected') {
      updates.rejectedAt = FieldValue.serverTimestamp()
    }
    await ref.set(updates, { merge: true })

    const item = parseBankTransferPayment(snap.id, {
      ...(snap.data() as Record<string, unknown>),
      ...updates,
      status: next,
    })

    if (next === 'confirmed' && item.digitalOrderId) {
      try {
        await updateDigitalServiceOrderStatus(item.digitalOrderId, 'paid')
      } catch (err) {
        console.warn('Bank confirm: digital order update skipped', err)
      }
    }

    return NextResponse.json({
      success: true,
      item: { ...item, status: next },
      message:
        next === 'confirmed'
          ? 'Bank transfer marked received. Tracked separately from PawaPay.'
          : next === 'rejected'
            ? 'Bank transfer marked not received.'
            : 'Bank transfer set back to waiting.',
    })
  } catch (err) {
    console.error('Admin bank-transfers PATCH:', err)
    return NextResponse.json({ error: 'Could not update bank transfer' }, { status: 502 })
  }
}
