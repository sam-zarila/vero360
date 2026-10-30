import { NextResponse } from 'next/server'
import {
  COURIER_CITY,
  estimateCourierPrice,
  isLilongweCity,
} from '@/lib/courier-pricing'
import { fulfillCourierGuestOrder } from '@/lib/courier-public'
import {
  createGuestOrder,
  findGuestOrderById,
  guestBankPayload,
  parseGuestBuyer,
  recordGuestBankTransfer,
  startGuestPawaPay,
} from '@/lib/guest-checkout'

export const dynamic = 'force-dynamic'

function quoteFromBody(body: Record<string, unknown>) {
  const pickup = String(body.pickupLocation || body.pickup || '').trim()
  const dropoff = String(body.dropoffLocation || body.dropoff || '').trim()
  const goodsType = String(body.goodsType || body.TypeOfGoods || 'Other').trim() || 'Other'
  const description = String(body.description || body.DescriptionOfGoods || '').trim()
  const notes = String(body.notes || '').trim()
  const city = String(body.city || body.CourierCity || COURIER_CITY).trim() || COURIER_CITY
  const distanceKm = Number(body.distanceKm)
  if (!isLilongweCity(city)) {
    throw new Error('Vero Courier is currently Lilongwe only.')
  }
  if (pickup.length < 4) throw new Error('Enter a pickup location in Lilongwe.')
  if (dropoff.length < 4) throw new Error('Enter a drop-off location in Lilongwe.')
  const quote = estimateCourierPrice({
    distanceKm: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 3,
    goodsType,
    description: [description, notes].filter(Boolean).join(' '),
  })
  return { pickup, dropoff, goodsType, description, notes, city, quote }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const details = quoteFromBody(body)
    const buyer = await parseGuestBuyer(body)
    const amountMwk = details.quote.amountMwk

    const txRef = `vero-courier-${Date.now()}`
    const { id: orderId } = await createGuestOrder({
      kind: 'courier',
      amountMwk,
      txRef,
      buyerUid: buyer.buyerUid,
      buyerName: buyer.buyerName,
      buyerEmail: buyer.buyerEmail,
      buyerPhone: buyer.buyerPhone,
      title: `Courier · ${details.pickup} → ${details.dropoff}`,
      paymentProvider: buyer.isBank ? 'bank_transfer' : 'pawapay',
      bankProofUrl: buyer.isBank ? buyer.proofUrl : undefined,
      extra: {
        pickupLocation: details.pickup,
        dropoffLocation: details.dropoff,
        goodsType: details.goodsType,
        description: details.description,
        notes: details.notes,
        city: COURIER_CITY,
        distanceKm: details.quote.distanceKm,
        etaMinutes: details.quote.etaMinutes,
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
        kind: 'courier',
        title: 'Vero Courier',
      })
      const latest = await findGuestOrderById(orderId)
      const fulfilled = await fulfillCourierGuestOrder({
        orderId,
        data: latest?.data || {},
      })
      return NextResponse.json({
        success: true,
        pending: true,
        method: 'bank_transfer',
        orderId,
        txRef,
        amountMwk,
        status: 'pending',
        trackingNumber: fulfilled.trackingNumber,
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
      kind: 'courier',
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
    console.error('Courier guest checkout:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start courier booking' },
      { status: 400 },
    )
  }
}
