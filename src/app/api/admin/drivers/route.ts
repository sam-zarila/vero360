import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { parseDriversResponse } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    // Agents must use /api/admin/agent-drivers (scoped to their registrations).
    if (isAgentRole(actor.admin.role)) {
      return NextResponse.json(
        {
          error:
            'Agents can only view drivers they registered. Use the agent drivers list.',
        },
        { status: 403 },
      )
    }
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const skip = url.searchParams.get('skip') || '0'
    const take = url.searchParams.get('take') || '200'

    const qs = new URLSearchParams({ skip, take })

    const { res, body, error } = await nestAdminFetch(
      ['admin', `drivers?${qs.toString()}`],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const parsed = parseDriversResponse(body)
    const counts = {
      all: parsed.drivers.length,
      pending: parsed.drivers.filter(d => d.status === 'PENDING_VERIFICATION')
        .length,
      verified: parsed.drivers.filter(d => d.status === 'VERIFIED').length,
      rejected: parsed.drivers.filter(d => d.status === 'REJECTED').length,
      suspended: parsed.drivers.filter(d => d.status === 'SUSPENDED').length,
      pendingVehicles: parsed.drivers.filter(d =>
        d.taxis.some(t => t.status === 'PENDING_REVIEW'),
      ).length,
    }

    return NextResponse.json({
      success: true,
      drivers: parsed.drivers,
      total: parsed.total,
      counts,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin drivers GET error:', err)
    return NextResponse.json({ error: 'Could not reach drivers API' }, { status: 502 })
  }
}
