import 'server-only'

import { PAYOUT_BANKS, PAYOUT_MOMO } from '@/lib/payout-destinations'

const PAYCHANGU_BASE = 'https://api.paychangu.com'

/** Server-only PayChangu secret (never expose to the browser). */
export function getPaychanguSecretKey(): string {
  const fromEnv = (process.env.PAYCHANGU_SECRET_KEY || '').trim()
  if (fromEnv) return fromEnv.replace(/^Bearer\s+/i, '')
  // Dev fallback matches Flutter debug key so local checkout can be tested.
  if (process.env.NODE_ENV !== 'production') {
    return 'SEC-TEST-MwiucQ5HO8rCVIWzykcMK13UkXTdsO7u'
  }
  return ''
}

export function paychanguConfigured(): boolean {
  return getPaychanguSecretKey().length > 0
}

export function paychanguAuthHeaders(): Record<string, string> {
  const key = getPaychanguSecretKey()
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}`,
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    for (const k of ['message', 'error', 'detail']) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  if (typeof body === 'string' && body.trim()) {
    return body.trim().slice(0, 400)
  }
  return fallback
}

export type PaychanguPayoutInput =
  | {
      method: 'bank'
      amount: number
      chargeId: string
      bankUuid: string
      accountName: string
      accountNumber: string
      email?: string
    }
  | {
      method: 'mobile_money'
      amount: number
      chargeId: string
      operatorId: string
      mobile: string
      email?: string
    }

export async function initializePaychanguPayout(
  input: PaychanguPayoutInput,
): Promise<unknown> {
  if (!paychanguConfigured()) {
    throw new Error('PayChangu is not configured. Set PAYCHANGU_SECRET_KEY.')
  }

  const amountStr = String(Math.round(input.amount))
  const chargeId = input.chargeId.replace(/[^A-Za-z0-9-_]/g, '')

  let url: string
  let payload: Record<string, unknown>

  if (input.method === 'bank') {
    if (!PAYOUT_BANKS.some(b => b.uuid === input.bankUuid)) {
      throw new Error('Unknown bank. Pick a supported Malawian bank.')
    }
    url = `${PAYCHANGU_BASE}/direct-charge/payouts/initialize`
    payload = {
      payout_method: 'bank_transfer',
      bank_uuid: input.bankUuid,
      amount: amountStr,
      charge_id: chargeId,
      bank_account_name: input.accountName,
      bank_account_number: input.accountNumber,
    }
    if (input.email) payload.email = input.email
  } else {
    if (!PAYOUT_MOMO.some(m => m.id === input.operatorId)) {
      throw new Error('Unknown mobile-money operator.')
    }
    url = `${PAYCHANGU_BASE}/mobile-money/payouts/initialize`
    payload = {
      mobile_money_operator_ref_id: input.operatorId,
      mobile: input.mobile,
      amount: amountStr,
      charge_id: chargeId,
    }
    if (input.email) payload.email = input.email
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: paychanguAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(extractMessage(parsed, `Payout failed (${res.status})`))
  }

  if (parsed && typeof parsed === 'object' && parsed !== null && 'status' in parsed) {
    const status = String((parsed as { status: unknown }).status || '').toLowerCase()
    if (status && status !== 'success') {
      throw new Error(extractMessage(parsed, 'Payout failed'))
    }
  }

  return parsed
}

export type PaychanguInitResult = {
  checkoutUrl: string
  raw: Record<string, unknown>
}

export async function initiatePaychanguPayment(input: {
  txRef: string
  firstName: string
  lastName: string
  email: string
  phone: string
  amountMwk: number
  description: string
  callbackUrl: string
  returnUrl: string
}): Promise<PaychanguInitResult> {
  if (!paychanguConfigured()) {
    throw new Error('Payment is not configured. Set PAYCHANGU_SECRET_KEY.')
  }

  const res = await fetch(`${PAYCHANGU_BASE}/payment`, {
    method: 'POST',
    headers: paychanguAuthHeaders(),
    body: JSON.stringify({
      tx_ref: input.txRef,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone_number: input.phone,
      currency: 'MWK',
      amount: String(Math.round(input.amountMwk)),
      payment_methods: ['mobile_money', 'bank'],
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      customization: {
        title: 'Vero 360 Payment',
        description: input.description.slice(0, 200),
      },
    }),
  })

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      String(body.message || body.error || `PayChangu HTTP ${res.status}`),
    )
  }
  const status = String(body.status || '').toLowerCase()
  if (status !== 'success') {
    throw new Error(String(body.message || 'Payment initiation failed'))
  }
  const data = (body.data || {}) as Record<string, unknown>
  const checkoutUrl = String(data.checkout_url || '').trim()
  if (!checkoutUrl) throw new Error('PayChangu did not return a checkout URL')
  return { checkoutUrl, raw: body }
}

export async function verifyPaychanguTransaction(txRef: string): Promise<{
  paid: boolean
  status: string
  raw: Record<string, unknown>
}> {
  if (!paychanguConfigured()) {
    return { paid: false, status: 'unconfigured', raw: {} }
  }
  const res = await fetch(
    `${PAYCHANGU_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
    { headers: paychanguAuthHeaders(), cache: 'no-store' },
  )
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const data = (body.data || {}) as Record<string, unknown>
  // Prefer nested payment status — top-level "success" often means API OK only.
  const nested = String(data.status || data.payment_status || '').toLowerCase()
  const top = String(body.status || '').toLowerCase()
  const status = nested || top
  const paid = ['successful', 'success', 'paid', 'completed'].includes(status)
  // If nested exists and is not a paid state, do not trust top-level "success".
  if (nested && !paid) {
    return { paid: false, status: nested, raw: body }
  }
  return { paid, status, raw: body }
}
