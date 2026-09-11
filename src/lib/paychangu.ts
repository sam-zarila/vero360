import 'server-only'

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
  const data = (body.data || body) as Record<string, unknown>
  const status = String(
    data.status || body.status || data.payment_status || '',
  ).toLowerCase()
  const paid = ['successful', 'success', 'paid', 'completed'].includes(status)
  return { paid, status, raw: body }
}
