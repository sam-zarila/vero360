import { NextResponse } from 'next/server'
import {
  createGuestOrder,
  guestBankPayload,
  loadMarketplaceForCheckout,
  marketplaceGuestTotal,
  parseGuestBuyer,
  recordGuestBankTransfer,
  startGuestPawaPay,
} from '@/lib/guest-checkout'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const listingId = String(body.listingId || body.productId || '').trim()
    const deliveryAddress = String(body.deliveryAddress || '').trim()
    const notes = String(body.notes || '').trim()
    const quantity = Math.max(1, Math.min(20, Math.round(Number(body.quantity) || 1)))

    const buyer = await parseGuestBuyer(body)
    const listing = await loadMarketplaceForCheckout(listingId)
    const unit = marketplaceGuestTotal(listing)
    const amountMwk = unit * quantity
    if (!(amountMwk > 0)) {
      return NextResponse.json({ error: 'This product cannot be purchased.' }, { status: 400 })
    }
    if (deliveryAddress.length < 6) {
      return NextResponse.json(
        { error: 'Enter a delivery address in Malawi.' },
        { status: 400 },
      )
    }

    const txRef = `vero-mp-${Date.now()}`
    const { id: orderId } = await createGuestOrder({
      kind: 'marketplace',
      amountMwk,
      txRef,
      buyerUid: buyer.buyerUid,
      buyerName: buyer.buyerName,
      buyerEmail: buyer.buyerEmail,
      buyerPhone: buyer.buyerPhone,
      title: listing.name,
      paymentProvider: buyer.isBank ? 'bank_transfer' : 'pawapay',
      bankProofUrl: buyer.isBank ? buyer.proofUrl : undefined,
      extra: {
        listingId: listing.key,
        sqlId: listing.sqlId,
        quantity,
        unitPriceMwk: unit,
        sellerPriceMwk: listing.price,
        imageUrl: listing.image,
        category: listing.category,
        merchantName: listing.merchantName,
        merchantEmail: listing.merchantEmail,
        merchantPhone: listing.merchantPhone,
        merchantFirebaseUid: listing.merchantFirebaseUid,
        deliveryAddress,
        notes,
        location: listing.location,
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
        kind: 'marketplace',
        title: listing.name,
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
      kind: 'marketplace',
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
    console.error('Marketplace guest checkout:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start payment' },
      { status: 400 },
    )
  }
}
