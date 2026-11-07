import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseAdminSosIncidentsResponse } from '@/lib/rides'
import { nestAdminFetch } from '@/lib/nest-admin'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const url = new URL(request.url)
    const qs = new URLSearchParams()
    const skip = url.searchParams.get('skip')
    const take = url.searchParams.get('take')
    if (skip) qs.set('skip', skip)
    if (take) qs.set('take', take)

    const query = qs.toString()
    const path = query ? `rides/sos?${query}` : 'rides/sos'
    const { res, body, error } = await nestAdminFetch(['admin', path], undefined, request)

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const parsed = parseAdminSosIncidentsResponse(body)
    return NextResponse.json({
      success: true,
      items: parsed.incidents,
      total: parsed.total,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin SOS list GET error:', err)
    return NextResponse.json({ error: 'Could not reach SOS API' }, { status: 502 })
  }
}
