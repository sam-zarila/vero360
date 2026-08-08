import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

type NewsletterBody = {
  email?: string
}

function newsletterDocId(email: string) {
  return `newsletter__${email.replace(/\//g, '_')}`
}

export async function POST(request: Request) {
  let body: NewsletterBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  let alreadySubscribed = false

  try {
    const ref = getAdminDb().collection('verochat_sessions').doc(newsletterDocId(email))
    const existing = await ref.get()
    alreadySubscribed = existing.exists

    if (!alreadySubscribed) {
      await ref.set({
        type: 'newsletter',
        visitorName: 'Newsletter Subscriber',
        visitorEmail: email,
        status: 'closed',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastMessage: 'Newsletter signup',
        unreadForAgent: 0,
        source: 'website_footer',
      })
    }
  } catch (err) {
    console.error('Newsletter Firestore error:', err)
    return NextResponse.json(
      { error: 'Could not save your subscription. Please try again.' },
      { status: 502 },
    )
  }

  const to = process.env.CONTACT_TO_EMAIL || 'info@vero360.app'
  const resendKey = process.env.RESEND_API_KEY

  if (resendKey && !alreadySubscribed) {
    const from = process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>'
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: '[Vero360] New newsletter signup',
          text: `New newsletter signup\n\nEmail: ${email}\nSource: website footer`,
        }),
      })
      if (!res.ok) {
        console.error('Newsletter Resend error:', await res.text())
      }
    } catch (err) {
      console.error('Newsletter notify error:', err)
    }
  }

  return NextResponse.json({
    success: true,
    alreadySubscribed,
  })
}
