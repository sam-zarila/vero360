import { NextResponse } from 'next/server'
import {
  createGuestOrder,
  guestBankPayload,
  loadFoodForCheckout,
  markGuestBankSubmitted,
  parseGuestBuyer,
  recordGuestBankTransfer,
  startGuestPawaPay,
} from '@/lib/guest-checkout'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const listingId = String(body.listingId || body.foodId || '').trim()
    const deliveryAddress = String(body.deliveryAddress || '').trim()
    const notes = String(body.notes || '').trim()
    const quantity = Math.max(1, Math.min(20, Math.round(Number(body.quantity) || 1)))

    const buyer = await parseGuestBuyer(body)
    const item = await loadFoodForCheckout(listingId)
    const amountMwk = Math.round(item.price) * quantity
    if (!(amountMwk > 0)) {
      return NextResponse.json({ error: 'This meal cannot be ordered.' }, { status: 400 })
    }
    if (deliveryAddress.length < 6) {
      return NextResponse.json(
        { error: 'Enter a delivery address so the kitchen can send the order.' },
        { status: 400 },
      )
    }

    const txRef = `vero-food-${Date.now()}`
    const { id: orderId } = await createGuestOrder({
      kind: 'food',
      amountMwk,
      txRef,
      buyerUid: buyer.buyerUid,
      buyerName: buyer.buyerName,
      buyerEmail: buyer.buyerEmail,
      buyerPhone: buyer.buyerPhone,
      title: item.name,
      paymentProvider: buyer.isBank ? 'bank_transfer' : 'pawapay',
      bankProofUrl: buyer.isBank ? buyer.proofUrl : undefined,
      extra: {
        listingId: item.key || item.rawId,
        quantity,
        unitPriceMwk: item.price,
        imageUrl: item.image,
        merchantId: item.merchantId,
        merchantName: item.restaurant,
        restaurantId: item.rawId,
        deliveryAddress,
        notes,
        location: item.location,
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
        kind: 'food',
        title: item.name,
      })
      await markGuestBankSubmitted(orderId)
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
      kind: 'food',
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
    console.error('Food guest checkout:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start payment' },
      { status: 400 },
    )
  }
}
