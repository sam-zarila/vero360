import { NextResponse } from 'next/server'

type NotifyBody = {
  type?: 'new_chat' | 'new_message'
  sessionId?: string
  visitorName?: string
  visitorEmail?: string
  message?: string
}

export async function POST(request: Request) {
  let body: NotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorName = body.visitorName?.trim() || 'Website visitor'
  const visitorEmail = body.visitorEmail?.trim() || 'unknown'
  const message = body.message?.trim() || ''
  const type = body.type === 'new_chat' ? 'new_chat' : 'new_message'

  const to = process.env.CONTACT_TO_EMAIL || process.env.VEROCHAT_NOTIFY_EMAIL
  const resendKey = process.env.RESEND_API_KEY

  if (!to || !resendKey) {
    return NextResponse.json({ ok: true, skipped: 'email_not_configured' })
  }

  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://vero360.app'
  const inboxUrl = `${adminBase.replace(/\/$/, '')}/dashboard/verochat`

  const subject =
    type === 'new_chat'
      ? `[VeroChat] ${visitorName} started a live chat`
      : `[VeroChat] New message from ${visitorName}`

  const text =
    type === 'new_chat'
      ? `A visitor opened VeroChat on the website.\n\nName: ${visitorName}\nEmail: ${visitorEmail}\n\nOpen inbox: ${inboxUrl}`
      : `New VeroChat message\n\nFrom: ${visitorName} (${visitorEmail})\n\n${message}\n\nReply: ${inboxUrl}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>',
      to: [to],
      reply_to: visitorEmail.includes('@') ? visitorEmail : undefined,
      subject,
      text,
    }),
  })

  if (!res.ok) {
    console.error('VeroChat notify error:', await res.text())
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
