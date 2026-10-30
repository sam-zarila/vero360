import { NextResponse } from 'next/server'
import {
  createGuestOrder,
  guestBankPayload,
  loadStayForCheckout,
  parseGuestBuyer,
  recordGuestBankTransfer,
  startGuestPawaPay,
} from '@/lib/guest-checkout'

export const dynamic = 'force-dynamic'

function isoDate(value: unknown): string {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Choose a check-in date')
  }
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) throw new Error('Choose a check-in date')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d.getTime() < today.getTime() - 12 * 60 * 60 * 1000) {
    throw new Error('Check-in cannot be in the past')
  }
  return raw
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const listingId = String(body.listingId || body.stayId || '').trim()
    const nights = Math.max(1, Math.min(30, Math.round(Number(body.nights) || 1)))
    const checkInDate = isoDate(body.checkInDate)

    const buyer = await parseGuestBuyer(body)
    const stay = await loadStayForCheckout(listingId)
    const amountMwk = Math.round(stay.price) * nights
    if (!(amountMwk > 0)) {
      return NextResponse.json({ error: 'This stay cannot be booked.' }, { status: 400 })
    }

    const checkOut = new Date(`${checkInDate}T12:00:00`)
    checkOut.setDate(checkOut.getDate() + nights)

    const txRef = `vero-stay-${Date.now()}`
    const { id: orderId } = await createGuestOrder({
      kind: 'stay',
      amountMwk,
      txRef,
      buyerUid: buyer.buyerUid,
      buyerName: buyer.buyerName,
      buyerEmail: buyer.buyerEmail,
      buyerPhone: buyer.buyerPhone,
      title: stay.name,
      paymentProvider: buyer.isBank ? 'bank_transfer' : 'pawapay',
      bankProofUrl: buyer.isBank ? buyer.proofUrl : undefined,
      extra: {
        listingId,
        accommodationId: stay.id,
        nights,
        checkInDate,
        checkOutDate: checkOut.toISOString(),
        unitPriceMwk: stay.price,
        imageUrl: stay.image,
        location: stay.location,
        accommodationType: stay.accommodationType,
        hostName: stay.hostName,
        hostEmail: stay.hostEmail,
        hostPhone: stay.hostPhone,
        hostFirebaseUid: stay.hostFirebaseUid,
        pricingPeriod: stay.pricingPeriod,
      },
    })

    if (buyer.isBank) {
      await recordGuestBankTransfer({
        orderId,
        txRef,
        amountMwk,
        proofUrl: buyer.proofUrl,
        buyerUid: buyer.buyerUid,
        buyerName: buyer.buyerName,
        buyerEmail: buyer.buyerEmail,
        buyerPhone: buyer.buyerPhone,
        kind: 'stay',
        title: stay.name,
      })
      return NextResponse.json({
        success: true,
        pending: true,
        method: 'bank_transfer',
        orderId,
        txRef,
        amountMwk,
        status: 'pending',
        bank: await guestBankPayload(),
      })
    }

    const depositId = await startGuestPawaPay({
      orderId,
      buyerUid: buyer.buyerUid,
      amountMwk,
      buyerPhone: buyer.buyerPhone,
      network: buyer.network || 'airtel',
      txRef,
      kind: 'stay',
    })
    return NextResponse.json({
      success: true,
      pending: true,
      depositId,
      orderId,
      txRef,
      amountMwk,
      status: 'pending',
    })
  } catch (err) {
    console.error('Stay guest checkout:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start payment' },
      { status: 400 },
    )
  }
}
