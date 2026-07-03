import { NextResponse } from 'next/server'

type InquiryBody = {
  name?: string
  email?: string
  subject?: string
  message?: string
}

export async function POST(request: Request) {
  let body: InquiryBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = body.name?.trim()
  const email = body.email?.trim()
  const subject = body.subject?.trim() || 'New inquiry from Vero360 website'
  const message = body.message?.trim()

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const to = process.env.CONTACT_TO_EMAIL
  const resendKey = process.env.RESEND_API_KEY

  if (!to || !resendKey) {
    console.error('Inquiry received but email is not configured (CONTACT_TO_EMAIL / RESEND_API_KEY).')
    return NextResponse.json(
      { error: 'Inquiry service is not configured yet. Please try again later.' },
      { status: 503 },
    )
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Vero360 Website <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `[Vero360 Inquiry] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    }),
  })

  if (!res.ok) {
    console.error('Resend error:', await res.text())
    return NextResponse.json({ error: 'Failed to send inquiry. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
