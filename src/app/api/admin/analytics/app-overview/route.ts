import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import { fetchAppPerformanceOverview } from '@/lib/app-performance'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const allowed =
      isFullAdminRole(actor.admin.role) || isMarketerRole(actor.admin.role)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const overview = await fetchAppPerformanceOverview({
      request,
      includePlatformBalance: actor.admin.role === 'super_admin',
    })

    const forMarketer = isMarketerRole(actor.admin.role)
    const safe = forMarketer
      ? {
          ...overview,
          financeNote: '',
          platformBalanceMwk: null,
          services: overview.services.map(service => ({
            ...service,
            moneyMwk: 0,
            detail: service.detail.replace(/\s*·\s*MWK\s[\d,]+\s+paid so far/gi, ''),
          })),
        }
      : overview

    return NextResponse.json({
      success: true,
      overview: safe,
      viewerRole: actor.admin.role,
      hideMoney: forMarketer,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin app overview:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load app performance' },
      { status: 502 },
    )
  }
}
