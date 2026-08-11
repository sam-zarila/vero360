import 'server-only'

import { PAYOUT_BANKS, PAYOUT_MOMO } from '@/lib/payout-destinations'

const BASE = 'https://api.paychangu.com'
const TEST_FALLBACK = 'SEC-TEST-MwiucQ5HO8rCVIWzykcMK13UkXTdsO7u'

function authorization(): string {
  const raw = (process.env.PAYCHANGU_SECRET_KEY || '').trim()
  const key = raw || (process.env.NODE_ENV === 'production' ? '' : TEST_FALLBACK)
  if (!key || key.includes('XXXX')) {
    throw new Error(
      'PayChangu is not configured. Set PAYCHANGU_SECRET_KEY in .env.local.',
    )
  }
  return key.startsWith('Bearer ') ? key : `Bearer ${key}`
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
  const amountStr = String(Math.round(input.amount))
  const chargeId = input.chargeId.replace(/[^A-Za-z0-9-_]/g, '')

  let url: string
  let payload: Record<string, unknown>

  if (input.method === 'bank') {
    if (!PAYOUT_BANKS.some(b => b.uuid === input.bankUuid)) {
      throw new Error('Unknown bank. Pick a supported Malawian bank.')
    }
    url = `${BASE}/direct-charge/payouts/initialize`
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
    url = `${BASE}/mobile-money/payouts/initialize`
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
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization(),
    },
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
