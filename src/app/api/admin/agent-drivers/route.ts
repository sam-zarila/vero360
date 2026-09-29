import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'
import { parseDriversResponse, type FleetDriver } from '@/lib/drivers'
import { nestAdminFetch } from '@/lib/nest-admin'
import { listAgentRegistrations } from '@/lib/agent-registrations-admin'
import { formatPhoneE164 } from '@/lib/agent-registrations'
import { driverMatchesAgentRegistration } from '@/lib/agent-driver-access'

export const dynamic = 'force-dynamic'

function countDrivers(drivers: FleetDriver[]) {
  return {
    all: drivers.length,
    pending: drivers.filter(d => d.status === 'PENDING_VERIFICATION').length,
    verified: drivers.filter(d => d.status === 'VERIFIED').length,
    rejected: drivers.filter(d => d.status === 'REJECTED').length,
    suspended: drivers.filter(d => d.status === 'SUSPENDED').length,
    pendingVehicles: drivers.filter(d =>
      d.taxis.some(t => t.status === 'PENDING_REVIEW'),
    ).length,
  }
}

/**
 * Drivers for the agent portal.
 * Agents only see ride drivers that match people they onboarded as drivers.
 * Full admins get the full Nest fleet list.
 */
export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
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

    if (isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({
        success: true,
        drivers: parsed.drivers,
        total: parsed.total,
        counts: countDrivers(parsed.drivers),
        scope: 'all',
      })
    }

    const regs = await listAgentRegistrations({ agentUid: actor.uid })
    const myDrivers = regs
      .filter(r => r.role === 'driver')
      .map(r => ({
        email: r.email,
        phone: r.phone ? formatPhoneE164(r.phone) : r.phone,
      }))

    const drivers = parsed.drivers.filter(d =>
      myDrivers.some(reg => driverMatchesAgentRegistration(d, reg)),
    )

    return NextResponse.json({
      success: true,
      drivers,
      total: drivers.length,
      counts: countDrivers(drivers),
      scope: 'mine',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Agent drivers GET:', err)
    return NextResponse.json({ error: 'Could not load drivers' }, { status: 502 })
  }
}
