import 'server-only'

<<<<<<< HEAD
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
=======
const SANDBOX = 'https://api.sandbox.pawapay.io'
const LIVE = 'https://api.pawapay.io'

export type PawaPayNetwork = 'airtel' | 'tnm'

export function pawapayConfigured(): boolean {
  return pawapayToken().length > 0
}

function pawapayToken(): string {
  let token = String(process.env.PAWAPAY_API_TOKEN || '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim()
  }
  return token.replace(/^Bearer\s+/i, '').replace(/\s+/g, '')
}

function baseUrl(): string {
  const mode = String(process.env.PAWAPAY_ENV || '').trim().toLowerCase()
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
  if (mode === 'live' || mode === 'production') return LIVE
  return SANDBOX
}

<<<<<<< HEAD
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
=======
export function networkFromMalawiPhone(phone: string): PawaPayNetwork | '' {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('265') ? `0${digits.slice(3)}` : digits
  if (local.startsWith('09')) return 'airtel'
  if (local.startsWith('08')) return 'tnm'
  return ''
}

export function providerForNetwork(network: PawaPayNetwork): string {
  return network === 'airtel' ? 'AIRTEL_MWI' : 'TNM_MWI'
}

/** PawaPay expects 265XXXXXXXX with no plus. */
export function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('265') && digits.length >= 12) return digits
  if (digits.startsWith('0') && digits.length >= 9) return `265${digits.slice(1)}`
  return ''
}

export function explainPawaPayFailure(raw: string): string {
  const text = raw.toLowerCase()
  if (text.includes('not approve') || text.includes('payment_not_approved')) {
    return 'The prompt was not approved. Open it on your phone, enter your PIN, then try again.'
  }
  if (text.includes('insufficient') || text.includes('enough funds')) {
    return 'This wallet does not have enough money for this payment.'
  }
  if (
    text.includes('payer_not_found') ||
    text.includes('does not belong') ||
    text.includes('does not have an')
  ) {
    return 'This number is not registered on the network you selected.'
  }
  if (text.includes('in progress') || text.includes('payment_in_progress')) {
    return 'A payment is already waiting on this number. Finish that prompt, then try again.'
  }
  if (text.includes('limit')) {
    return 'This wallet has reached its mobile-money limit.'
  }
  if (!raw.trim()) {
    return 'The payment was not completed. Approve the prompt on your phone and try again.'
  }
  return raw
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
}

function failureMessage(body: Record<string, unknown>): string {
  const reason = body.failureReason
  if (typeof reason === 'string' && reason.trim()) return reason.trim()
  if (reason && typeof reason === 'object') {
    const record = reason as Record<string, unknown>
    const message = String(record.failureMessage || record.failureCode || '').trim()
    if (message) return message
  }
<<<<<<< HEAD
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
=======
  return String(body.message || body.error || 'PawaPay rejected the payment')
}

async function pawapayRequest(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const token = pawapayToken()
  if (!token) {
    throw new Error('PawaPay is not configured. Set PAWAPAY_API_TOKEN.')
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

export async function createPawaPayDeposit(input: {
  depositId: string
  amountMwk: number
  phone: string
  network: PawaPayNetwork
  reference: string
}): Promise<{ status: string }> {
  const phone = toMsisdn(input.phone)
  if (!phone) throw new Error('Enter a valid Airtel Money or TNM Mpamba number.')
  const amount = Math.round(input.amountMwk)
  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error('Enter a valid amount.')
  }
  const reference = String(input.reference || input.depositId).slice(0, 64)
  const { ok, body } = await pawapayRequest('/v2/deposits', {
    method: 'POST',
    body: JSON.stringify({
      depositId: input.depositId,
      amount: String(amount),
      currency: 'MWK',
      clientReferenceId: reference,
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
      customerMessage: 'Vero360',
      payer: {
        type: 'MMO',
        accountDetails: {
<<<<<<< HEAD
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
=======
          phoneNumber: phone,
          provider: providerForNetwork(input.network),
        },
      },
      metadata: [{ orderId: reference }],
    }),
  })
  if (!ok) throw new Error(explainPawaPayFailure(failureMessage(body)))
  const status = String(body.status || '').toUpperCase()
  if (status === 'REJECTED') {
    throw new Error(explainPawaPayFailure(failureMessage(body)))
  }
  if (status !== 'ACCEPTED' && status !== 'DUPLICATE_IGNORED') {
    throw new Error(explainPawaPayFailure(failureMessage(body)))
  }
  return { status }
}

export type PawaPayDepositState = {
  status: 'completed' | 'failed' | 'pending'
  failure: string
}

export async function readPawaPayDeposit(depositId: string): Promise<PawaPayDepositState> {
  const { ok, body } = await pawapayRequest(
    `/v2/deposits/${encodeURIComponent(depositId)}`,
    { method: 'GET' },
  )
  const data = body.data
  const remote = Array.isArray(data)
    ? ((data[0] && typeof data[0] === 'object'
        ? data[0]
        : body) as Record<string, unknown>)
    : data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : body
  const status = String(remote.status || '').toUpperCase()
  if (!ok && !status) return { status: 'pending', failure: '' }
  if (status === 'COMPLETED') return { status: 'completed', failure: '' }
  if (status === 'FAILED' || status === 'REJECTED') {
    return {
      status: 'failed',
      failure: explainPawaPayFailure(failureMessage(remote)),
    }
  }
  return { status: 'pending', failure: '' }
>>>>>>> b27f17e1ec721d07e637ed8271680a19a894dc87
}
