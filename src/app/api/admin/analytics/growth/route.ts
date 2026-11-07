import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import { buildGrowthOverview } from '@/lib/growth-metrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const allowed =
      isFullAdminRole(actor.admin.role) || isMarketerRole(actor.admin.role)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const days = Number(url.searchParams.get('days') || 28)
    const overview = await buildGrowthOverview({ days, request })

    return NextResponse.json({
      success: true,
      ...overview,
      viewerRole: actor.admin.role,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin growth overview:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load growth overview' },
      { status: 502 },
    )
  }
}
