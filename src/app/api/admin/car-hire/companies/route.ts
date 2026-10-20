import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseOpsCompanyPage } from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const status =
      (new URL(request.url).searchParams.get('status') || '').trim().toUpperCase() ||
      'QUEUE'

    const qs = new URLSearchParams({ status })
    const { res, body, error } = await nestOpsFetch([
      'car-rental',
      `operator-reviews?${qs.toString()}`,
    ])

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    return NextResponse.json({ success: true, items: parseOpsCompanyPage(body) })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire companies GET error:', err)
    return NextResponse.json({ error: 'Could not reach car-hire operator API' }, { status: 502 })
  }
}
