import { NextResponse } from 'next/server'
import { readPawaPayDeposit } from '@/lib/pawapay'
import { settleDigitalOrderPayment } from '@/lib/digital-services-checkout'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const depositId = String(searchParams.get('depositId') || '').trim()
    const txRef = String(searchParams.get('tx_ref') || '').trim()
    const orderId = String(searchParams.get('order_id') || '').trim()
    if (!depositId || !txRef || !orderId) {
      return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 })
    }

    const deposit = await readPawaPayDeposit(depositId)
    if (deposit.status !== 'completed') {
      return NextResponse.json({
        success: true,
        paid: false,
        status: deposit.status,
        error: deposit.failure || undefined,
      })
    }
    if (deposit.reference && deposit.reference !== txRef) {
      return NextResponse.json({ error: 'Payment does not match this order.' }, { status: 400 })
    }

    const settled = await settleDigitalOrderPayment({ orderId, txRef })
    return NextResponse.json({
      success: true,
      paid: true,
      status: 'paid',
      orderId,
      alreadyPaid: settled.alreadyPaid,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not check payment' },
      { status: 400 },
    )
  }
}
