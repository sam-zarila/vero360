import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { setAgentRegistrationVerified } from '@/lib/agent-registrations-admin'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  AGENT_REGISTRATIONS_COLLECTION,
  parseAgentRegistration,
} from '@/lib/agent-registrations'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const snap = await getAdminDb().collection(AGENT_REGISTRATIONS_COLLECTION).doc(id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const item = parseAgentRegistration(snap.id, snap.data() as Record<string, unknown>)
    if (isAgentRole(actor.admin.role) && item.agentUid !== actor.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ success: true, registration: item })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Failed to load registration' }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const snap = await getAdminDb().collection(AGENT_REGISTRATIONS_COLLECTION).doc(id).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const existing = parseAgentRegistration(snap.id, snap.data() as Record<string, unknown>)
    if (isAgentRole(actor.admin.role) && existing.agentUid !== actor.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const body = (raw || {}) as { isVerified?: boolean }
    if (typeof body.isVerified !== 'boolean') {
      return NextResponse.json({ error: 'isVerified boolean required' }, { status: 400 })
    }

    const registration = await setAgentRegistrationVerified(id, body.isVerified)
    return NextResponse.json({ success: true, registration })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    )
  }
}
