import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { nestVerifyRegistrationOtp, resolveOtpChannel } from '@/lib/agent-otp'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const body = (raw || {}) as {
      email?: string
      phone?: string
      channel?: string
      code?: string
    }

    const code = String(body.code || '').trim()
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    const resolved = resolveOtpChannel({
      email: body.email,
      phone: body.phone,
      preferred: body.channel,
    })

    const verificationTicket = await nestVerifyRegistrationOtp({
      channel: resolved.channel,
      email: resolved.email,
      phone: resolved.phone,
      code,
    })

    return NextResponse.json({
      success: true,
      channel: resolved.channel,
      verificationTicket,
      message: 'Contact verified',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Invalid or expired code'
    const status = /Invalid|expired|required|Email or phone/i.test(message) ? 400 : 502
    console.error('Agent OTP verify:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
