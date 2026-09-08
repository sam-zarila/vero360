import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { nestRequestRegistrationOtp, resolveOtpChannel } from '@/lib/agent-otp'

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
    }

    const resolved = resolveOtpChannel({
      email: body.email,
      phone: body.phone,
      preferred: body.channel,
    })

    await nestRequestRegistrationOtp({
      channel: resolved.channel,
      email: resolved.email,
      phone: resolved.phone,
    })

    return NextResponse.json({
      success: true,
      channel: resolved.channel,
      destination:
        resolved.channel === 'email'
          ? resolved.email
          : resolved.phone,
      message:
        resolved.channel === 'email'
          ? `Verification code sent to ${resolved.email}`
          : `Verification code sent by SMS to ${resolved.phone}`,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Could not send code'
    const status = /required|Email or phone/i.test(message) ? 400 : 502
    console.error('Agent OTP request:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
