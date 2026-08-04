import { NextResponse } from 'next/server'
import { parseLatestArrivals } from '@/lib/latest-arrivals'
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

    const items = parseLatestArrivals(body).sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Admin latest arrivals GET error:', err)
    return NextResponse.json({ error: 'Could not reach latest arrivals API' }, { status: 502 })
  }
}
