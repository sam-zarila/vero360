import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminRide } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'
import { recordPanelAudit } from '@/lib/audit-trail-admin'

type Ctx = { params: Promise<{ id: string }> }

/** Alias of assign — backend accepts reassign for ACCEPTED / DRIVER_ARRIVED. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const payload = await request.json().catch(() => ({}))

    const { res, body, error } = await nestAdminFetch(
      ['admin', 'rides', id, 'reassign'],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const ride = parseAdminRide(body)
    await recordPanelAudit(actor, {
      action: 'reassign',
      resource: 'ride',
      resourceId: id,
      summary: `Reassigned taxi ${payload?.taxiId ?? '?'} on ride ${ride?.id || id}`,
    })
    return NextResponse.json({ success: true, ride })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin ride reassign error:', err)
    return NextResponse.json({ error: 'Could not reassign driver' }, { status: 502 })
  }
}
