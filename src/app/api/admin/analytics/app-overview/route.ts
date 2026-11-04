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

    return NextResponse.json({
      success: true,
      overview,
      viewerRole: actor.admin.role,
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
