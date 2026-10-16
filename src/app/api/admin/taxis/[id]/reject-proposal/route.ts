import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseTaxi } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'
import { assertCanManageFleetTaxi } from '@/lib/agent-driver-access'
import { recordPanelAudit } from '@/lib/audit-trail-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    await assertCanManageFleetTaxi(actor, id, request)

    const payload = await request.json().catch(() => ({}))
    const reason =
      typeof (payload as { reason?: unknown }).reason === 'string'
        ? (payload as { reason: string }).reason
        : ''
    if (!reason.trim()) {
      return NextResponse.json(
        { error: 'A rejection reason is required' },
        { status: 400 },
      )
    }
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'taxis', id, 'reject-proposal'],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      },
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    const taxi = parseTaxi(body)
    await recordPanelAudit(actor, {
      action: 'reject',
      resource: 'taxi',
      resourceId: id,
      summary: `Rejected taxi proposal ${taxi?.licensePlate || id}`,
    })
    return NextResponse.json({ success: true, taxi: taxi ?? body })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: unknown }).status)
        : 0
    if (status === 403 || status === 404) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Forbidden' },
        { status },
      )
    }
    return NextResponse.json({ error: 'Reject failed' }, { status: 502 })
  }
}
