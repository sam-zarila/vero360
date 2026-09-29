import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { enrichStayListings } from '@/lib/stay-rooms'
import { parseStayListings } from '@/lib/stay'
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

    const res = await fetch(veroEndpoint('accommodations', 'all'), {
      headers,
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load accommodations') },
        { status: res.status },
      )
    }

    let items = parseStayListings(body)
    try {
      items = await enrichStayListings(items)
    } catch (err) {
      console.warn('Stay listing enrichment skipped:', err)
    }

    const typeCounts: Record<string, number> = {}
    for (const t of ['hotel', 'lodge', 'bnb', 'house', 'hostel', 'apartment']) {
      typeCounts[t] = items.filter(i => i.accommodationType === t).length
    }

    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        available: items.filter(i => i.isAvailable === true).length,
        unavailable: items.filter(i => i.isAvailable === false).length,
        ...typeCounts,
      },
    })
  } catch (err) {
    console.error('Admin stay listings GET error:', err)
    return NextResponse.json({ error: 'Could not reach accommodations API' }, { status: 502 })
  }
}
