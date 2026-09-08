import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { ADMINS_COLLECTION, isFullAdminRole, parsePanelAdmin } from '@/lib/admins'
import { getAdminDb } from '@/lib/firebase-admin'
import { listAgentRegistrations } from '@/lib/agent-registrations-admin'

export const dynamic = 'force-dynamic'

/** Active agents with registration counts (full admins only). */
export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Only admins can list agents' }, { status: 403 })
    }

    const snap = await getAdminDb().collection(ADMINS_COLLECTION).get()
    const agents = snap.docs
      .map(d => parsePanelAdmin(d.id, d.data() as Record<string, unknown>))
      .filter(a => a.role === 'agent')
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    const regs = await listAgentRegistrations()
    const byAgent = new Map<string, number>()
    for (const r of regs) {
      byAgent.set(r.agentUid, (byAgent.get(r.agentUid) || 0) + 1)
    }

    return NextResponse.json({
      success: true,
      agents: agents.map(a => ({
        id: a.id,
        email: a.email,
        displayName: a.displayName,
        status: a.status,
        createdAt: a.createdAt,
        registrationCount: byAgent.get(a.id) || 0,
      })),
      totalRegistrations: regs.length,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Agents GET:', err)
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
  }
}
