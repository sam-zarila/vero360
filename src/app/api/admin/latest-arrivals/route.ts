import { NextResponse } from 'next/server'
import {
  filterLatestArrivalsLast24h,
  parseLatestArrivals,
} from '@/lib/latest-arrivals'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export async function GET() {
  try {
    const res = await fetch(veroEndpoint('latestarrivals'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load latest arrivals') },
        { status: res.status },
      )
    }

    const all = parseLatestArrivals(body)
    const items = filterLatestArrivalsLast24h(all)

    return NextResponse.json({
      success: true,
      items,
      counts: {
        active24h: items.length,
        totalFromApi: all.length,
      },
      windowHours: 24,
    })
  } catch (err) {
    console.error('Admin latest arrivals GET error:', err)
    return NextResponse.json({ error: 'Could not reach latest arrivals API' }, { status: 502 })
  }
}
