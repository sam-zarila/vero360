import 'server-only'

import { PAYOUT_MOMO } from '@/lib/payout-destinations'

const SANDBOX = 'https://api.sandbox.pawapay.io'
const LIVE = 'https://api.pawapay.io'

export type PawaPayProvider = 'AIRTEL_MWI' | 'TNM_MWI'

export function getPawaPayToken(): string {
  return (process.env.PAWAPAY_API_TOKEN || '').trim()
}

export function pawaPayConfigured(): boolean {
  return getPawaPayToken().length > 0
}

export function pawaPayBaseUrl(): string {
  const mode = (process.env.PAWAPAY_ENV || '').trim().toLowerCase()
  if (mode === 'live' || mode === 'production') return LIVE
  return SANDBOX
}

/** PayChangu operator ids used by the merchant wallet and admin payout form. */
export function pawaPayProviderForOperator(operatorId: string): PawaPayProvider | null {
  const id = operatorId.trim()
  const airtel = PAYOUT_MOMO[0].id
  const tnm = PAYOUT_MOMO[1].id
  if (id === airtel || id.toLowerCase().includes('airtel')) return 'AIRTEL_MWI'
  if (id === tnm || id.toLowerCase().includes('tnm') || id.toLowerCase().includes('mpamba')) {
    return 'TNM_MWI'
  }
  return null
}

/** Local 099… / 088… → 2659… / 2658… */
export function toPawaPayMsisdn(localMobile: string): string {
  const mobile = localMobile.trim()
  if (!/^0\d{8,9}$/.test(mobile)) return ''
  return `265${mobile.slice(1)}`
}

export type PawaPayPayoutResult = {
  payoutId: string
  status: string
  failureMessage: string
}

function failureMessage(body: Record<string, unknown>): string {
  const reason = body.failureReason
  if (typeof reason === 'string' && reason.trim()) return reason.trim()
  if (reason && typeof reason === 'object') {
    const record = reason as Record<string, unknown>
    const message = String(record.failureMessage || record.failureCode || '').trim()
    if (message) return message
  }
  const message = String(body.message || body.error || '').trim()
  return message || 'PawaPay rejected the payout'
}

export function providerFromMalawiPhone(phone: string): PawaPayProvider | null {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('265') ? `0${digits.slice(3)}` : digits
  if (/^09\d{8}$/.test(local)) return 'AIRTEL_MWI'
  if (/^08\d{8}$/.test(local)) return 'TNM_MWI'
  return null
}

export async function initiatePawaPayDeposit(input: {
  depositId: string
  amountMwk: number
  phoneE164: string
  provider: PawaPayProvider
  reference: string
}): Promise<PawaPayPayoutResult> {
  const token = getPawaPayToken()
  if (!token) {
    throw new Error('PawaPay is not configured. Set PAWAPAY_API_TOKEN.')
  }
  const res = await fetch(`${pawaPayBaseUrl()}/v2/deposits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      depositId: input.depositId,
      amount: String(Math.round(input.amountMwk)),
      currency: 'MWK',
      clientReferenceId: input.reference.slice(0, 64),
      customerMessage: 'Vero360',
      payer: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: input.phoneE164,
          provider: input.provider,
        },
      },
      metadata: [{ orderId: input.reference.slice(0, 64) }],
    }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(failureMessage(body) || `PawaPay HTTP ${res.status}`)
  const status = String(body.status || '').toUpperCase()
  if (status === 'REJECTED') throw new Error(failureMessage(body))
  if (status !== 'ACCEPTED' && status !== 'DUPLICATE_IGNORED') {
    throw new Error(failureMessage(body) || `Unexpected PawaPay status ${status || 'unknown'}`)
  }
  return { payoutId: input.depositId, status, failureMessage: '' }
}

export async function readPawaPayDeposit(depositId: string): Promise<{
  status: 'completed' | 'failed' | 'pending'
  reference: string
  failure: string
}> {
  const token = getPawaPayToken()
  if (!token) throw new Error('PawaPay is not configured. Set PAWAPAY_API_TOKEN.')
  const res = await fetch(`${pawaPayBaseUrl()}/v2/deposits/${encodeURIComponent(depositId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>
  const status = String(data.status || '').toUpperCase()
  const direct = String(data.clientReferenceId || '')
  const metadata = Array.isArray(data.metadata) ? data.metadata : []
  const fromMeta = metadata
    .map(row => row as Record<string, unknown>)
    .map(row => String(row.orderId || row.fieldValue || ''))
    .find(value => value.length > 0)
  const value = direct || fromMeta || ''
  if (status === 'COMPLETED') return { status: 'completed', reference: value, failure: '' }
  if (status === 'FAILED' || status === 'REJECTED') {
    return { status: 'failed', reference: value, failure: failureMessage(data) }
  }
  return { status: 'pending', reference: value, failure: '' }
}

export async function initiatePawaPayPayout(input: {
  payoutId: string
  amountMwk: number
  phoneE164: string
  provider: PawaPayProvider
}): Promise<PawaPayPayoutResult> {
  const token = getPawaPayToken()
  if (!token) {
    throw new Error('PawaPay is not configured. Set PAWAPAY_API_TOKEN.')
  }

  const res = await fetch(`${pawaPayBaseUrl()}/v2/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      payoutId: input.payoutId,
      amount: String(Math.round(input.amountMwk)),
      currency: 'MWK',
      recipient: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: input.phoneE164,
          provider: input.provider,
        },
      },
    }),
  })

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(failureMessage(body) || `PawaPay HTTP ${res.status}`)
  }

  const status = String(body.status || '').toUpperCase()
  if (status === 'REJECTED') {
    throw new Error(failureMessage(body))
  }
  if (status !== 'ACCEPTED' && status !== 'DUPLICATE_IGNORED') {
    throw new Error(failureMessage(body) || `Unexpected PawaPay status ${status || 'unknown'}`)
  }

  return {
    payoutId: String(body.payoutId || input.payoutId),
    status,
    failureMessage: '',
  }
}
