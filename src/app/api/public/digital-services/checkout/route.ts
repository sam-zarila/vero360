import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDigitalServicesConfig } from '@/lib/digital-services-config'
import {
  computeDigitalAmountMwk,
  createPendingDigitalOrder,
  normalizeMalawiPhone,
} from '@/lib/digital-services-checkout'
import {
  initiatePawaPayDeposit,
  pawaPayConfigured,
  providerFromMalawiPhone,
  toPawaPayMsisdn,
} from '@/lib/pawapay'

export const dynamic = 'force-dynamic'

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(request: Request) {
  try {
    if (!pawaPayConfigured()) {
      return NextResponse.json(
        {
          error:
            'Online payments are not configured yet. Add PAWAPAY_API_TOKEN in Netlify env.',
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
    if (product.key === 'netflix') {
      return NextResponse.json(
        { error: 'Choose a Netflix plan first (Mobile, Basic, Standard, or Premium).' },
        { status: 400 },
      )
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

    const provider = providerFromMalawiPhone(buyerPhone)
    const local = buyerPhone.replace(/^\+/, '').replace(/^265/, '0')
    const phone = toPawaPayMsisdn(local)
    if (!provider || !phone) {
      return NextResponse.json(
        { error: 'Use an Airtel Money (099) or TNM Mpamba (088) number.' },
        { status: 400 },
      )
    }
    const depositId = randomUUID()
    await initiatePawaPayDeposit({
      depositId,
      amountMwk,
      phoneE164: phone,
      provider,
      reference: txRef,
    })

    return NextResponse.json({
      success: true,
      pending: true,
      depositId,
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
