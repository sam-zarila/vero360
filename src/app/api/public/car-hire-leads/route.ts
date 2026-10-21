import { NextResponse } from 'next/server'
import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

export const dynamic = 'force-dynamic'

const TYPES = ['INDIVIDUAL', 'BUSINESS'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * Public lead capture for /list-your-cars. No auth by design, so every field
 * is trimmed and capped here as well as in the Nest DTO.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    const body = await request.json()
    payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return bad('Send the form as JSON.')
  }

  // Honeypot: bots fill it, humans never see it. Pretend it worked.
  if (text(payload.website, 200)) {
    return NextResponse.json({ success: true, duplicate: false })
  }

  const companyName = text(payload.companyName, 160)
  const contactName = text(payload.contactName, 120)
  const email = text(payload.email, 160).toLowerCase()
  const phone = text(payload.phone, 40)
  const rawType = text(payload.type, 16).toUpperCase()
  const type = (TYPES as readonly string[]).includes(rawType) ? rawType : 'BUSINESS'
  const city = text(payload.city, 120)
  const message = text(payload.message, 2000)

  if (!companyName) return bad('Add your company name (or your own name).')
  if (!contactName) return bad('Add the name of the person we should speak to.')
  if (!email) return bad('Add an email address so we can reply.')
  if (!EMAIL_RE.test(email)) return bad('That email address does not look right.')
  if (!phone) return bad('Add a phone number so partnerships can call you.')

  let fleetSize: number | undefined
  if (payload.fleetSize !== undefined && payload.fleetSize !== null && payload.fleetSize !== '') {
    const parsed = Number(payload.fleetSize)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5000) {
      return bad('Fleet size must be a whole number between 0 and 5000.')
    }
    fleetSize = parsed
  }

  try {
    const res = await fetch(veroEndpoint('car-hire', 'leads'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        companyName,
        contactName,
        email,
        phone,
        type,
        ...(city ? { city } : {}),
        ...(fleetSize !== undefined ? { fleetSize } : {}),
        ...(message ? { message } : {}),
      }),
      cache: 'no-store',
    })
    const data = await readJsonSafe(res)

    if (res.status === 400) {
      return bad(apiErrorMessage(data, 'Check the form and try again.'))
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: 'We could not save your request right now. Please try again shortly.' },
        { status: 502 },
      )
    }

    const body = (data && typeof data === 'object' ? data : {}) as {
      duplicate?: unknown
    }
    return NextResponse.json({ success: true, duplicate: body.duplicate === true })
  } catch {
    return NextResponse.json(
      { error: 'We could not reach our partnerships service. Please try again shortly.' },
      { status: 502 },
    )
  }
}
