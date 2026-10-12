import 'server-only'

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
  if (mode === 'live' || mode === 'production') return LIVE
  return SANDBOX
}

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
}

function failureMessage(body: Record<string, unknown>): string {
  const reason = body.failureReason
  if (typeof reason === 'string' && reason.trim()) return reason.trim()
  if (reason && typeof reason === 'object') {
    const record = reason as Record<string, unknown>
    const message = String(record.failureMessage || record.failureCode || '').trim()
    if (message) return message
  }
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
      customerMessage: 'Vero360',
      payer: {
        type: 'MMO',
        accountDetails: {
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
}
