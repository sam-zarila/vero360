import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { parseStayBookings } from '@/lib/stay'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const headers: HeadersInit = { Accept: 'application/json' }
    const auth = getVeroAuthHeader(request)
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('bookings', 'admin', 'all'), {
      headers,
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load stay bookings') },
        { status: res.status },
      )
    }

    const recent = parseStayBookings(body)
      .sort((a, b) => {
        const at = a.createdAt
          ? new Date(a.createdAt).getTime()
          : a.bookingDate
            ? new Date(a.bookingDate).getTime()
            : 0
        const bt = b.createdAt
          ? new Date(b.createdAt).getTime()
          : b.bookingDate
            ? new Date(b.bookingDate).getTime()
            : 0
        return bt - at
      })
      .slice(0, 80)
    const pending = recent.filter(item => item.bookingStatus === 'pending')
    const latest = recent[0] || null

    return NextResponse.json({
      success: true,
      pending: pending.length,
      pendingIds: pending.map(item => item.id),
      recentIds: recent.map(item => item.id),
      latest: latest
        ? {
            id: latest.id,
            bookingNumber: latest.bookingNumber,
            accommodationName: latest.accommodationName,
            guestName: latest.guestName,
          }
        : null,
    })
  } catch (err) {
    console.error('Admin stay bookings pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach bookings API' }, { status: 502 })
  }
}
