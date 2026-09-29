import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'
import { assertCanManageFleetDriver } from '@/lib/agent-driver-access'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params

    const loaded = await nestAdminFetch(['admin', 'drivers', id], undefined, request)
    if (!loaded.res.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.res.status })
    }
    const existing = parseDriver(loaded.body)
    if (!existing) {
      return NextResponse.json({ error: 'Invalid driver payload' }, { status: 502 })
    }
    await assertCanManageFleetDriver(actor, existing)

    const { res, body, error } = await nestAdminFetch(
      ['admin', 'drivers', id, 'verify'],
      { method: 'POST' },
      request,
    )
    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }
    return NextResponse.json({ success: true, driver: parseDriver(body) ?? body })
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
    return NextResponse.json({ error: 'Verify failed' }, { status: 502 })
  }
}
