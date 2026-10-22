import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminRidesResponse } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const [issuesResult, recentResult] = await Promise.all([
      nestAdminFetch(['admin', 'rides', 'issues-count'], undefined, request),
      nestAdminFetch(['admin', 'rides?take=40'], undefined, request),
    ])

    const { res, body, error } = issuesResult
    if (!res.ok && recentResult.res.status === 404 && res.status === 404) {
      return NextResponse.json(
        {
          error:
            'Ride admin API is not on the backend yet. Redeploy vero-backend with GET /vero/admin/rides.',
        },
        { status: 404 },
      )
    }
    if (!res.ok && !recentResult.res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const issues =
      body && typeof body === 'object' && 'issues' in body
        ? Number((body as { issues: unknown }).issues)
        : 0

    const recent = recentResult.res.ok
      ? parseAdminRidesResponse(recentResult.body).rides
      : []
    const latest = recent[0] || null

    return NextResponse.json({
      success: true,
      issues: Number.isFinite(issues) ? issues : 0,
      recentIds: recent.map(r => r.id).filter(id => id > 0),
      latest: latest
        ? {
            id: latest.id,
            status: latest.status,
            pickupAddress: latest.pickupAddress,
            passengerName: latest.passengerName,
          }
        : null,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin rides pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach rides API' }, { status: 502 })
  }
}
