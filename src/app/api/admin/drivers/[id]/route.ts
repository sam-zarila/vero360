import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'
import { assertCanManageFleetDriver } from '@/lib/agent-driver-access'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'drivers', id],
      undefined,
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    const driver = parseDriver(body)
    if (!driver) {
      return NextResponse.json({ error: 'Invalid driver payload' }, { status: 502 })
    }
    await assertCanManageFleetDriver(actor, driver)
    return NextResponse.json({ success: true, driver })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: unknown }).status)
        : 0
    if (status === 403) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Forbidden' },
        { status: 403 },
      )
    }
    console.error('Admin driver detail GET error:', err)
    return NextResponse.json({ error: 'Could not load driver' }, { status: 502 })
  }
}
