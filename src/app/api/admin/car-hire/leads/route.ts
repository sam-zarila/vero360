import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { nestOpsFetch } from '@/lib/nest-ops'

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISMISSED', 'ALL'] as const

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const url = new URL(request.url)
    const raw = (url.searchParams.get('status') || 'NEW').trim().toUpperCase()
    const status = (STATUSES as readonly string[]).includes(raw) ? raw : 'NEW'

    const { res, body, error } = await nestOpsFetch(
      [`car-hire/leads?status=${encodeURIComponent(status)}`],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const source =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const items = Array.isArray(source.items) ? source.items : []
    const rawCounts =
      source.counts && typeof source.counts === 'object'
        ? (source.counts as Record<string, unknown>)
        : null

    // Older backends may omit counts; derive what we can from the returned rows.
    const derived = items.reduce<Record<string, number>>((acc, item) => {
      const leadStatus =
        item && typeof item === 'object'
          ? String((item as Record<string, unknown>).status || '').toUpperCase()
          : ''
      if (leadStatus) acc[leadStatus] = (acc[leadStatus] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      items,
      counts: {
        NEW: count(rawCounts?.NEW ?? derived.NEW),
        CONTACTED: count(rawCounts?.CONTACTED ?? derived.CONTACTED),
        QUALIFIED: count(rawCounts?.QUALIFIED ?? derived.QUALIFIED),
        DISMISSED: count(rawCounts?.DISMISSED ?? derived.DISMISSED),
      },
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire leads GET error:', err)
    return NextResponse.json({ error: 'Could not reach the car-hire leads API' }, { status: 502 })
  }
}
