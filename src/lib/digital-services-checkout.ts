import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { DIGITAL_SERVICE_ORDERS_COLLECTION } from '@/lib/digital-services'
import {
  creditDigitalOrderPlatformFee,
  notifyDigitalBuyer,
} from '@/lib/digital-services-admin'
import type { DigitalProductPriceConfig } from '@/lib/digital-services-config'
import {
  emailDigitalOrderPending,
  sendPaidDigitalOrderEmail,
} from '@/lib/digital-services-email'

export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim() ||
    'https://vero360.app'
  return raw.replace(/\/$/, '')
}

export function normalizeMalawiPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (/^0[89]\d{8}$/.test(digits)) return `+265${digits.slice(1)}`
  if (/^265[89]\d{8}$/.test(digits)) return `+${digits}`
  if (/^\+265[89]\d{8}$/.test(raw.trim())) return raw.trim()
  throw new Error('Enter a valid Malawi mobile number (e.g. 0881234567)')
}

export function splitBuyerName(fullName: string): {
  firstName: string
  lastName: string
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Customer'
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'Customer'
  return { firstName, lastName }
}

export function computeDigitalAmountMwk(opts: {
  product: DigitalProductPriceConfig
  selectedUsd?: number | null
  usdToMwkRate: number
}): { amountMwk: number; selectedUsd: number | null; isSubscription: boolean } {
  const fixed =
    typeof opts.product.fixedMwkPrice === 'number' && opts.product.fixedMwkPrice > 0
      ? Math.round(opts.product.fixedMwkPrice)
      : null

  // Match Flutter: fixed MWK products skip the USD picker.
  if (fixed != null) {
    return { amountMwk: fixed, selectedUsd: null, isSubscription: true }
  }

  const usd = Number(opts.selectedUsd)
  if (!Number.isFinite(usd) || usd < 1 || usd > 500) {
    throw new Error('Choose a USD amount between $1 and $500')
  }
  const rate = Math.max(1, Math.round(opts.usdToMwkRate || 4700))
  return {
    amountMwk: Math.round(usd * rate),
    selectedUsd: Math.round(usd * 100) / 100,
    isSubscription: false,
  }
}

export async function createPendingDigitalOrder(input: {
  product: DigitalProductPriceConfig
  amountMwk: number
  selectedUsd: number | null
  isSubscription: boolean
  txRef: string
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  source?: string
  isGuest?: boolean
  payoutKyc?: Record<string, unknown> | null
  paymentProvider?: string
  bankProofUrl?: string | null
}): Promise<string> {
  const isCrypto = String(input.product.category || '').toLowerCase() === 'crypto'
  const kind = isCrypto
    ? 'crypto'
    : input.isSubscription
      ? 'subscription'
      : 'gift_card'
  const ref = getAdminDb().collection(DIGITAL_SERVICE_ORDERS_COLLECTION).doc()
  await ref.set({
    productKey: input.product.key,
    productName: input.product.name,
    productSubtitle: input.product.subtitle || '',
    brandTag: input.product.brandTag || '',
    category: input.product.category,
    kind,
    period: input.isSubscription ? 'monthly' : null,
    periodLabel: input.isSubscription ? '1 month' : null,
    selectedUsd: input.selectedUsd,
    amountMwk: input.amountMwk,
    currency: 'MWK',
    status: 'pending_payment',
    txRef: input.txRef,
    depositId: null,
    paymentProvider: input.paymentProvider || 'pawapay',
    ...(input.bankProofUrl
      ? {
          bankProofUrl: input.bankProofUrl,
          bankProofUrls: [input.bankProofUrl],
          bankTransferReportedAt: FieldValue.serverTimestamp(),
        }
      : {}),
    buyerUid: input.buyerUid,
    isGuest: input.isGuest !== false,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerPhone: input.buyerPhone,
    platformFeeCredited: false,
    source: input.source || 'web',
    ...(input.payoutKyc
      ? {
          payoutKyc: {
            ...input.payoutKyc,
            uploadedAt: FieldValue.serverTimestamp(),
          },
        }
      : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const emailed = await emailDigitalOrderPending({
    orderId: ref.id,
    to: input.buyerEmail,
    buyerName: input.buyerName,
    buyerPhone: input.buyerPhone,
    productName: input.product.name,
    productSubtitle: input.product.subtitle || '',
    amountMwk: input.amountMwk,
    selectedUsd: input.selectedUsd,
    txRef: input.txRef,
    paymentProvider: input.paymentProvider || 'pawapay',
    isBank: (input.paymentProvider || '') === 'bank_transfer',
    periodLabel: input.isSubscription ? '1 month' : '',
  }).catch(err => {
    console.warn('Digital pending-order email:', err)
    return false
  })
  if (emailed) {
    await ref
      .set(
        {
          pendingEmailSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch(() => {})
  }

  await notifyDigitalBuyer({
    order: {
      id: ref.id,
      buyerUid: input.buyerUid,
      buyerEmail: input.buyerEmail,
      isGuest: input.isGuest !== false,
      productName: input.product.name,
    },
    type: 'digital_pending',
    title: `Payment awaiting · ${input.product.name}`,
    body: `Payment is awaiting confirmation for your ${input.product.name} order. Approve the prompt on your phone, then we will process it.`,
  }).catch(err => {
    console.warn('Digital pending-order push:', err)
    return false
  })

  return ref.id
}

export async function findDigitalOrderByTxRef(txRef: string) {
  const snap = await getAdminDb()
    .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
    .where('txRef', '==', txRef)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, data: doc.data() as Record<string, unknown> }
}

/** Mark paid + credit platform wallet (idempotent). */
export async function settleDigitalOrderPayment(opts: {
  orderId: string
  txRef: string
}): Promise<{ alreadyPaid: boolean }> {
  const ref = getAdminDb()
    .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
    .doc(opts.orderId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Order not found')
  const data = snap.data() || {}
  const alreadyPaid =
    String(data.status || '').toLowerCase() === 'paid' ||
    String(data.status || '').toLowerCase() === 'fulfilled'

  if (!alreadyPaid) {
    await ref.set(
      {
        status: 'paid',
        txRef: opts.txRef,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  const paidData = {
    ...data,
    txRef: opts.txRef,
    status: 'paid',
  }
  await sendPaidDigitalOrderEmail(opts.orderId, paidData)
  const productName = String(data.productName || 'Digital service').trim()
  await notifyDigitalBuyer({
    order: {
      id: opts.orderId,
      buyerUid: String(data.buyerUid || ''),
      buyerEmail: String(data.buyerEmail || ''),
      isGuest: data.isGuest === true,
      productName,
    },
    type: 'digital_order',
    title: `We received your order · ${productName}`,
    body: `We have received your ${productName} payment. We are processing your order now — you will get your details in My Digital Orders.`,
  }).catch(err => {
    console.warn('Digital paid-order push:', err)
    return false
  })

  try {
    await creditDigitalOrderPlatformFee(opts.orderId)
  } catch {
    // Admin can backfill; payment is still marked paid.
  }

  return { alreadyPaid }
}
