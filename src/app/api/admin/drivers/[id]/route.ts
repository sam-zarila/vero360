import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'
import { assertCanManageFleetDriver } from '@/lib/agent-driver-access'
import { isFullAdminRole } from '@/lib/admins'
import { recordPanelAudit } from '@/lib/audit-trail-admin'

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

/** Deletes a pending or rejected driver application (full admins only). */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await ctx.params

    const loaded = await nestAdminFetch(['admin', 'drivers', id], undefined, request)
    if (!loaded.res.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.res.status })
    }
    const existing = parseDriver(loaded.body)
    if (!existing) {
      return NextResponse.json({ error: 'Invalid driver payload' }, { status: 502 })
    }
    if (existing.status !== 'PENDING_VERIFICATION' && existing.status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Only pending or rejected applications can be deleted.' },
        { status: 400 },
      )
    }

    const { res, error } = await nestAdminFetch(
      ['admin', 'drivers', id],
      { method: 'DELETE' },
      request,
    )
    if (!res.ok) {
      const message =
        res.status === 404
          ? 'The server does not support deleting drivers yet. Deploy the latest backend.'
          : error
      return NextResponse.json({ error: message }, { status: res.status })
    }

    await recordPanelAudit(actor, {
      action: 'delete',
      resource: 'driver',
      resourceId: id,
      summary: `Deleted driver application ${existing.name || id}`,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin driver DELETE error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 502 })
  }
}
