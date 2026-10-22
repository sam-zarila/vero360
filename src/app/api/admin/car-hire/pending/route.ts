import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { nestOpsFetch } from '@/lib/nest-ops'

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

/** Lightweight poll endpoint for car-hire moderation badges / notifications. */
export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const { res, body, error } = await nestOpsFetch(
      ['car-rental', 'moderation', 'pending-count'],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const source =
      body && typeof body === 'object'
        ? ((body as { data?: unknown }).data ?? body)
        : body
    const row =
      source && typeof source === 'object'
        ? (source as Record<string, unknown>)
        : {}

    return NextResponse.json({
      success: true,
      pendingReview: count(row.pendingReview),
      suspended: count(row.suspended),
      draft: count(row.draft),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach car-hire moderation API' }, { status: 502 })
  }
}
