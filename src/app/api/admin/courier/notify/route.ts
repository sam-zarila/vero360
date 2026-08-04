import { NextResponse } from 'next/server'

type NotifyBody = {
  id?: number
  trackingNumber?: string
  city?: string
  phone?: string
  pickupLocation?: string
  dropoffLocation?: string
}

/** Optional email alert when a new courier order is placed (Resend). */
export async function POST(request: Request) {
  let body: NotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const to = process.env.CONTACT_TO_EMAIL || process.env.VEROCHAT_NOTIFY_EMAIL || 'info@vero360.app'
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ ok: true, skipped: 'email_not_configured' })
  }

  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://vero360.app'
  const inboxUrl = `${adminBase.replace(/\/$/, '')}/dashboard/vero-courier`
  const idLabel = body.id ? `#${body.id}` : 'new order'
  const tracking = body.trackingNumber ? ` (${body.trackingNumber})` : ''

  const text = [
    `A new Vero Courier order was placed: ${idLabel}${tracking}`,
    '',
    `City: ${body.city || '—'}`,
    `Phone: ${body.phone || '—'}`,
    `Pickup: ${body.pickupLocation || '—'}`,
    `Drop-off: ${body.dropoffLocation || '—'}`,
    '',
    `Open admin: ${inboxUrl}`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>',
      to: [to],
      subject: `[Vero Courier] New order ${idLabel}${tracking}`,
      text,
    }),
  })

  if (!res.ok) {
    console.error('Courier notify error:', await res.text())
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
