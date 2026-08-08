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

  const inquiryId = `inquiry__${crypto.randomUUID()}`

  try {
    await getAdminDb()
      .collection('verochat_sessions')
      .doc(inquiryId)
      .set({
        type: 'inquiry',
        visitorName: name,
        visitorEmail: email,
        subject,
        message,
        status: 'open',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastMessage: message.slice(0, 200),
        unreadForAgent: 1,
        source: 'website_contact',
      })
  } catch (err) {
    console.error('Inquiry Firestore error:', err)
  }

  const origin = siteOrigin()

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: JSON.stringify({
        name,
        email,
        _replyto: email,
        _subject: `[Vero360 Inquiry] ${subject}`,
        _template: 'table',
        _captcha: 'false',
        message,
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean | string
      message?: string
    }

    const ok = data.success === true || data.success === 'true'
    if (!ok) {
      const needsActivation =
        typeof data.message === 'string' &&
        data.message.toLowerCase().includes('activation')

      console.error('FormSubmit error:', data)

      if (needsActivation) {
        return NextResponse.json({
          success: true,
          pendingActivation: true,
        })
      }

      return NextResponse.json(
        { error: 'Failed to send inquiry. Please try again.' },
        { status: 502 },
      )
    }
  } catch (err) {
    console.error('Inquiry email error:', err)
    return NextResponse.json(
      { error: 'Failed to send inquiry. Please try again.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
