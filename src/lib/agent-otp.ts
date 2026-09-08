import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'
import { formatPhoneE164 } from '@/lib/agent-registrations'

export type OtpChannel = 'email' | 'phone'

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

/** Public Nest OTP endpoints (same as Vero360App /auth/otp/*). */
export async function nestRequestRegistrationOtp(input: {
  channel: OtpChannel
  email?: string
  phone?: string
}) {
  const res = await fetch(veroEndpoint('auth', 'otp', 'request'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: input.channel,
      purpose: 'registration',
      ...(input.channel === 'email'
        ? { email: input.email }
        : { phone: input.phone }),
    }),
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
  const res = await fetch(veroEndpoint('auth', 'otp', 'verify'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: input.channel,
      code: input.code.trim(),
      ...(input.channel === 'email'
        ? { email: input.email }
        : { phone: input.phone }),
    }),
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'Invalid or expired code'))
  }
  const ticket =
    (body as { ticket?: unknown }).ticket ??
    (body as { verificationToken?: unknown }).verificationToken ??
    (body as { verificationTicket?: unknown }).verificationTicket
  const value = String(ticket || '').trim()
  if (!value) throw new Error('Invalid or expired code')
  return value
}
