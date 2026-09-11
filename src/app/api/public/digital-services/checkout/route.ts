import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDigitalServicesConfig } from '@/lib/digital-services-config'
import {
  computeDigitalAmountMwk,
  createPendingDigitalOrder,
  normalizeMalawiPhone,
  siteOrigin,
  splitBuyerName,
} from '@/lib/digital-services-checkout'
import {
  initiatePaychanguPayment,
  paychanguConfigured,
} from '@/lib/paychangu'

export const dynamic = 'force-dynamic'

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(request: Request) {
  try {
    if (!paychanguConfigured()) {
      return NextResponse.json(
        {
          error:
            'Online payments are not configured yet. Add PAYCHANGU_SECRET_KEY in Netlify env.',
        },
        { status: 503 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const productKey = String(body.productKey || '').trim()
    const buyerName = String(body.buyerName || '').trim()
    const buyerEmail = String(body.buyerEmail || '').trim().toLowerCase()
    const phoneRaw = String(body.buyerPhone || '').trim()
    const selectedUsdRaw = body.selectedUsd

    if (!productKey) {
      return NextResponse.json({ error: 'Missing product' }, { status: 400 })
    }
    if (buyerName.length < 2) {
      return NextResponse.json(
        { error: 'Enter your full name' },
        { status: 400 },
      )
    }
    if (!isEmail(buyerEmail)) {
      return NextResponse.json(
        { error: 'Enter a valid email address' },
        { status: 400 },
      )
    }

    let buyerPhone: string
    try {
      buyerPhone = normalizeMalawiPhone(phoneRaw)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid phone' },
        { status: 400 },
      )
    }

    const config = await getDigitalServicesConfig()
    const product = config.products.find(
      p => p.key === productKey && p.active !== false,
    )
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const selectedUsd =
      selectedUsdRaw === null || selectedUsdRaw === undefined || selectedUsdRaw === ''
        ? null
        : Number(selectedUsdRaw)

    let amountMwk: number
    let usd: number | null
    let isSubscription: boolean
    try {
      const computed = computeDigitalAmountMwk({
        product,
        selectedUsd,
        usdToMwkRate: config.usdToMwkRate,
      })
      amountMwk = computed.amountMwk
      usd = computed.selectedUsd
      isSubscription = computed.isSubscription
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid amount' },
        { status: 400 },
      )
    }

    const txRef = `vero-digital-${Date.now()}`
    const buyerUid = `web:${randomUUID()}`
    const orderId = await createPendingDigitalOrder({
      product,
      amountMwk,
      selectedUsd: usd,
      isSubscription,
      txRef,
      buyerUid,
      buyerName,
      buyerEmail,
      buyerPhone,
      source: 'web',
    })

    const origin = siteOrigin()
    const { firstName, lastName } = splitBuyerName(buyerName)
    const description = isSubscription
      ? `Digital: ${product.name} • MWK ${amountMwk}`
      : `Digital: ${product.name} • $${usd} (MWK ${amountMwk})`

    const { checkoutUrl } = await initiatePaychanguPayment({
      txRef,
      firstName,
      lastName,
      email: buyerEmail,
      phone: buyerPhone,
      amountMwk,
      description,
      callbackUrl: `${origin}/api/public/payments/paychangu/callback`,
      returnUrl: `${origin}/digital-services/payment/return?tx_ref=${encodeURIComponent(txRef)}&order_id=${encodeURIComponent(orderId)}`,
    })

    return NextResponse.json({
      success: true,
      checkoutUrl,
      orderId,
      txRef,
      amountMwk,
    })
  } catch (err) {
    console.error('Digital checkout POST:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not start payment',
      },
      { status: 500 },
    )
  }
}
