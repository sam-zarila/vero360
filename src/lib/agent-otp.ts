import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'
import { formatPhoneE164 } from '@/lib/agent-registrations'

export type OtpChannel = 'email' | 'phone'

const REGISTRATION_PURPOSE = 'registration'

export function resolveOtpChannel(opts: {
  email?: string | null
  phone?: string | null
  preferred?: string | null
}): { channel: OtpChannel; email: string; phone: string } {
  const email = String(opts.email || '')
    .trim()
    .toLowerCase()
  const phoneRaw = String(opts.phone || '').trim()
  const phone = phoneRaw ? formatPhoneE164(phoneRaw) : ''
  const preferred = String(opts.preferred || '')
    .trim()
    .toLowerCase()

  if (preferred === 'email' && email) return { channel: 'email', email, phone }
  if (preferred === 'phone' && phone) return { channel: 'phone', email, phone }
  if (email) return { channel: 'email', email, phone }
  if (phone) return { channel: 'phone', email, phone }
  throw new Error('Email or phone is required to send OTP')
}

function extractVerificationTicket(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const o = body as Record<string, unknown>
  const data =
    o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : null
  const ticket =
    o.ticket ??
    o.verificationToken ??
    o.verificationTicket ??
    data?.ticket ??
    data?.verificationToken ??
    data?.verificationTicket
  return String(ticket || '').trim()
}

/**
 * Public Nest OTP — same endpoints as Vero360App
 * `RegistrationVerificationService` → `/vero/auth/otp/request|verify`
 * with `purpose: 'registration'`.
 */
export async function nestRequestRegistrationOtp(input: {
  channel: OtpChannel
  email?: string
  phone?: string
}) {
  const payload: Record<string, string> = {
    channel: input.channel,
    purpose: REGISTRATION_PURPOSE,
  }
  if (input.channel === 'email') {
    const email = String(input.email || '')
      .trim()
      .toLowerCase()
    if (!email) throw new Error('Email is required for email OTP')
    payload.email = email
  } else {
    const phone = input.phone ? formatPhoneE164(input.phone) : ''
    if (!phone) throw new Error('Phone is required for SMS OTP')
    payload.phone = phone
  }

  const res = await fetch(veroEndpoint('auth', 'otp', 'request'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'Could not send verification code'))
  }
  return body
}

export async function nestVerifyRegistrationOtp(input: {
  channel: OtpChannel
  email?: string
  phone?: string
  code: string
}): Promise<string> {
  const code = String(input.code || '').trim()
  if (!code) throw new Error('Verification code is required')

  const payload: Record<string, string> = {
    channel: input.channel,
    purpose: REGISTRATION_PURPOSE,
    code,
  }
  if (input.channel === 'email') {
    const email = String(input.email || '')
      .trim()
      .toLowerCase()
    if (!email) throw new Error('Email is required to verify OTP')
    payload.email = email
  } else {
    const phone = input.phone ? formatPhoneE164(input.phone) : ''
    if (!phone) throw new Error('Phone is required to verify OTP')
    payload.phone = phone
  }

  const res = await fetch(veroEndpoint('auth', 'otp', 'verify'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'Invalid or expired code'))
  }
  const value = extractVerificationTicket(body)
  if (!value || value.length < 8) throw new Error('Invalid or expired code')
  return value
}
