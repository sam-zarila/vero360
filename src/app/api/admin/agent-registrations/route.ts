import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import {
  createAgentRegistration,
  listAgentRegistrationsPayload,
} from '@/lib/agent-registrations-admin'
import type { CreateAgentRegistrationInput } from '@/lib/agent-registrations'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const url = new URL(request.url)
    const agentUid = url.searchParams.get('agentUid')

    if (isAgentRole(actor.admin.role)) {
      const payload = await listAgentRegistrationsPayload({ agentUid: actor.uid })
      return NextResponse.json({ success: true, ...payload, scope: 'mine' })
    }

    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = await listAgentRegistrationsPayload({
      agentUid: agentUid || null,
    })
    return NextResponse.json({ success: true, ...payload, scope: agentUid ? 'agent' : 'all' })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Agent registrations GET:', err)
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Only agents and admins can onboard users' }, { status: 403 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const body = (raw || {}) as CreateAgentRegistrationInput
    const result = await createAgentRegistration(body, actor.admin)

    return NextResponse.json(
      {
        success: true,
        registration: result.registration,
        userId: result.userId,
        authEmail: result.authEmail,
        tempPassword: result.tempPassword,
        usedTempPassword: result.usedTempPassword,
        message: 'Account created (as in app signup)',
      },
      { status: 201 },
    )
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Failed to register user'
    const status = /already exists|required|Valid email|Password/i.test(message) ? 400 : 500
    console.error('Agent registrations POST:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
