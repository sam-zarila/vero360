import { NextResponse } from 'next/server'
import {
  refreshAndSettleDeposit,
  refreshAndSettleReference,
} from '@/lib/pawapay-settle'

export const dynamic = 'force-dynamic'

/** Browser polling after a PawaPay prompt is sent. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const depositId = String(searchParams.get('deposit_id') || '').trim()
    const txRef = String(searchParams.get('tx_ref') || '').trim()
    const orderId = String(searchParams.get('order_id') || '').trim()

    const result = depositId
      ? await refreshAndSettleDeposit(depositId)
      : txRef
        ? await refreshAndSettleReference(txRef, orderId || undefined)
        : null

    if (!result) {
      return NextResponse.json(
        { error: 'Missing payment reference.' },
        { status: 400 },
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('PawaPay status:', err)
    return NextResponse.json(
      {
        success: false,
        paid: false,
        error: err instanceof Error ? err.message : 'Could not check payment',
      },
      { status: 400 },
    )
  }
}
