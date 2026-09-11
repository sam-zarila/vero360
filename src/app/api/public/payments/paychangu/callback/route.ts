import { NextResponse } from 'next/server'
import {
  findDigitalOrderByTxRef,
  settleDigitalOrderPayment,
} from '@/lib/digital-services-checkout'
import { verifyPaychanguTransaction } from '@/lib/paychangu'
import { getAdminDb } from '@/lib/firebase-admin'
import { DIGITAL_SERVICE_ORDERS_COLLECTION } from '@/lib/digital-services'

export const dynamic = 'force-dynamic'

async function settleFromTxRef(txRef: string, orderIdHint?: string | null) {
  const cleanTx = txRef.trim()
  if (!cleanTx) throw new Error('Missing tx_ref')

  let orderId = (orderIdHint || '').trim()
  if (!orderId) {
    const found = await findDigitalOrderByTxRef(cleanTx)
    if (!found) throw new Error('Order not found for this payment')
    orderId = found.id
  } else {
    const snap = await getAdminDb()
      .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
      .doc(orderId)
      .get()
    if (!snap.exists) throw new Error('Order not found')
  }

  const verify = await verifyPaychanguTransaction(cleanTx)
  if (!verify.paid) {
    return {
      success: false,
      paid: false,
      status: verify.status || 'pending',
      orderId,
      txRef: cleanTx,
    }
  }

  const settled = await settleDigitalOrderPayment({
    orderId,
    txRef: cleanTx,
  })
  return {
    success: true,
    paid: true,
    status: 'paid',
    orderId,
    txRef: cleanTx,
    alreadyPaid: settled.alreadyPaid,
  }
}

/** PayChangu server callback (webhook). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const txRef = String(
      body.tx_ref || body.txRef || body.reference || '',
    ).trim()
    const result = await settleFromTxRef(txRef)
    return NextResponse.json(result)
  } catch (err) {
    console.error('PayChangu callback:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Callback failed' },
      { status: 400 },
    )
  }
}

/** Browser / return-page polling. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const txRef = String(searchParams.get('tx_ref') || '').trim()
    const orderId = String(searchParams.get('order_id') || '').trim()
    const result = await settleFromTxRef(txRef, orderId || null)
    return NextResponse.json(result)
  } catch (err) {
    console.error('PayChangu verify GET:', err)
    return NextResponse.json(
      {
        success: false,
        paid: false,
        error: err instanceof Error ? err.message : 'Verify failed',
      },
      { status: 400 },
    )
  }
}
