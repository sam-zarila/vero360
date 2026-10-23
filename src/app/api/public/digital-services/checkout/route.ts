import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { DIGITAL_SERVICE_ORDERS_COLLECTION } from '@/lib/digital-services'
import { getDigitalServicesConfig } from '@/lib/digital-services-config'
import {
  computeDigitalAmountMwk,
  createPendingDigitalOrder,
  normalizeMalawiPhone,
} from '@/lib/digital-services-checkout'
import {
  assertPayoutKycComplete,
  detectDigitalPayoutKycKind,
} from '@/lib/digital-payout-kyc'
import { savePawaPayDeposit } from '@/lib/pawapay-deposits'
import {
  createPawaPayDeposit,
  networkFromMalawiPhone,
  pawaPayConfigured,
  providerForNetwork,
  type PawaPayNetwork,
} from '@/lib/pawapay'
import {
  getBankTransferConfig,
  publicBankTransferPayload,
} from '@/lib/bank-transfer-config'

export const dynamic = 'force-dynamic'

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const payMethod = String(body.method || body.payMethod || '')
      .trim()
      .toLowerCase()
    const isBank = payMethod === 'bank' || payMethod === 'bank_transfer'
    if (!isBank && !pawaPayConfigured()) {
      return NextResponse.json(
        {
          error:
            'Online payments are not configured yet. Add PAWAPAY_API_TOKEN in Netlify env.',
        },
        { status: 503 },
      )
    }
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
    if (product.key === 'chatgpt') {
      return NextResponse.json(
        { error: 'Choose a ChatGPT plan first (Basic ChatGPT Plus or ChatGPT Plus).' },
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

    const guessed = networkFromMalawiPhone(buyerPhone)
    const requested = String(body.network || '').trim().toLowerCase()
    const network: PawaPayNetwork | '' =
      requested === 'airtel' || requested === 'tnm' ? requested : guessed
    if (!isBank) {
      if (!network) {
        return NextResponse.json(
          { error: 'Use an Airtel Money (099) or TNM Mpamba (088) number.' },
          { status: 400 },
        )
      }
      if (guessed && network !== guessed) {
        return NextResponse.json(
          { error: 'This number does not match the network you selected.' },
          { status: 400 },
        )
      }
    }

    const payoutKind = detectDigitalPayoutKycKind(product)
    const rawKyc =
      body.payoutKyc && typeof body.payoutKyc === 'object'
        ? (body.payoutKyc as Record<string, unknown>)
        : {}
    const payoutKyc = payoutKind
      ? {
          kind: payoutKind,
          alipayWechatCodeUrl: String(rawKyc.alipayWechatCodeUrl || '').trim(),
          idInHandUrl: String(rawKyc.idInHandUrl || '').trim(),
          faceUrl: String(rawKyc.faceUrl || '').trim(),
          binanceId: String(rawKyc.binanceId || '').trim(),
          binanceAddress: String(rawKyc.binanceAddress || '').trim(),
          binanceCodeUrl: String(rawKyc.binanceCodeUrl || '').trim(),
        }
      : null
    if (payoutKind) {
      try {
        assertPayoutKycComplete(payoutKind, payoutKyc)
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Payout details required' },
          { status: 400 },
        )
      }
    }

    const txRef = `vero-digital-${Date.now()}`
    const buyerUid = `web:${randomUUID()}`
    if (isBank) {
      const bank = await getBankTransferConfig()
      if (!bank.enabled) {
        return NextResponse.json(
          { error: 'Bank transfer is not available right now. Use mobile money.' },
          { status: 400 },
        )
      }
      const proofUrl = String(body.proofUrl || body.bankProofUrl || '').trim()
      if (!/^https?:\/\//i.test(proofUrl)) {
        return NextResponse.json(
          { error: 'Upload a photo of your transfer slip so we can confirm the payment.' },
          { status: 400 },
        )
      }
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
        isGuest: true,
        payoutKyc,
        paymentProvider: 'bank_transfer',
        bankProofUrl: proofUrl,
      })
      await getAdminDb()
        .collection('bank_transfer_payments')
        .doc(orderId)
        .set({
          txRef,
          amountMwk,
          proofUrl,
          proofUrls: [proofUrl],
          buyerUid,
          buyerName,
          buyerEmail,
          buyerPhone,
          source: 'digital',
          title: product.name,
          digitalOrderId: orderId,
          status: 'pending_review',
          paymentProvider: 'bank_transfer',
          createdAt: FieldValue.serverTimestamp(),
        })
      return NextResponse.json({
        success: true,
        pending: true,
        method: 'bank_transfer',
        orderId,
        txRef,
        amountMwk,
        status: 'pending',
        bank: publicBankTransferPayload(bank),
      })
    }

    if (!network) {
      return NextResponse.json(
        { error: 'Use an Airtel Money (099) or TNM Mpamba (088) number.' },
        { status: 400 },
      )
    }

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
      isGuest: true,
      payoutKyc,
    })

    const depositId = randomUUID()
    try {
      await savePawaPayDeposit({
        depositId,
        userId: buyerUid,
        amount: amountMwk,
        phone: buyerPhone,
        provider: providerForNetwork(network),
        reference: txRef,
        orderId,
        kind: 'digital_order',
      })
      await createPawaPayDeposit({
        depositId,
        amountMwk,
        phone: buyerPhone,
        network,
        reference: txRef,
      })
      await getAdminDb()
        .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
        .doc(orderId)
        .set(
          {
            depositId,
            paymentProvider: 'pawapay',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
    } catch (err) {
      await getAdminDb()
        .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
        .doc(orderId)
        .set(
          {
            status: 'failed',
            depositId,
            paymentProvider: 'pawapay',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        .catch(() => {})
      throw err
    }

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
