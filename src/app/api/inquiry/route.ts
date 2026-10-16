import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

const FORMSUBMIT_ID =
  process.env.FORMSUBMIT_ID || 'af3930657a7c20515c4324c017f006ce'

type InquiryBody = {
  name?: string
  email?: string
  subject?: string
  message?: string
}

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  }
  return 'https://vero360.app'
}

async function saveInquiry(input: {
  name: string
  email: string
  subject: string
  message: string
}) {
  const inquiryId = `inquiry__${crypto.randomUUID()}`
  const text = input.subject
    ? `Subject: ${input.subject}\n\n${input.message}`
    : input.message
  const db = getAdminDb()
  const ref = db.collection('verochat_sessions').doc(inquiryId)
  await ref.set({
    type: 'inquiry',
    visitorName: input.name,
    visitorEmail: input.email,
    subject: input.subject,
    message: input.message,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastMessage: text.slice(0, 200),
    unreadForAgent: 1,
    source: 'website_contact',
  })
  await ref.collection('messages').add({
    text,
    sender: 'visitor',
    kind: 'text',
    createdAt: FieldValue.serverTimestamp(),
  })
  return inquiryId
}

async function emailViaResend(input: {
  name: string
  email: string
  subject: string
  message: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return false
  const to = process.env.CONTACT_TO_EMAIL || 'info@vero360.app'
  const from = process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: input.email,
      subject: `[Vero360 Inquiry] ${input.subject}`,
      text: `Name: ${input.name}\nEmail: ${input.email}\nSubject: ${input.subject}\n\n${input.message}\n\nOpen inbox: https://vero360.app/dashboard/verochat`,
    }),
  })
  if (!res.ok) {
    console.error('Inquiry Resend error:', await res.text())
    return false
  }
  return true
}

async function emailViaFormSubmit(input: {
  name: string
  email: string
  subject: string
  message: string
}) {
  const origin = siteOrigin()
  const res = await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: origin,
      Referer: `${origin}/`,
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      _replyto: input.email,
      _subject: `[Vero360 Inquiry] ${input.subject}`,
      _template: 'table',
      _captcha: 'false',
      message: input.message,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean | string
    message?: string
  }
  const ok = data.success === true || data.success === 'true'
  if (!ok) console.error('FormSubmit error:', data)
  return ok
}

export async function POST(request: Request) {
  let body: InquiryBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const subject = body.subject?.trim() || 'Inquiry from Vero360 website'
  const message = body.message?.trim()

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const inquiry = { name, email, subject, message }

  let saved = false
  try {
    await saveInquiry(inquiry)
    saved = true
  } catch (err) {
    console.error('Inquiry Firestore error:', err)
  }

  let emailed = false
  try {
    emailed = await emailViaResend(inquiry)
  } catch (err) {
    console.error('Inquiry Resend error:', err)
  }
  if (!emailed) {
    try {
      emailed = await emailViaFormSubmit(inquiry)
    } catch (err) {
      console.error('Inquiry email error:', err)
    }
  }

  if (!saved && !emailed) {
    return NextResponse.json(
      { error: 'Failed to send inquiry. Please try again.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
