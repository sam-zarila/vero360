import { NextResponse } from 'next/server'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type NewsletterBody = {
  email?: string
}

function newsletterDocId(email: string) {
  // Deterministic id; keep Firestore path-safe (no '/')
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
    const ref = doc(db, 'verochat_sessions', newsletterDocId(email))
    const existing = await getDoc(ref)
    alreadySubscribed = existing.exists()

    if (!alreadySubscribed) {
      await setDoc(ref, {
        type: 'newsletter',
        visitorName: 'Newsletter Subscriber',
        visitorEmail: email,
        status: 'closed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
          subject: '[Vero360] New newsletter subscriber',
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
