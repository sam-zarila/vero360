import { NextResponse } from 'next/server'
import {
  forwardGeocodeLilongwe,
  reverseGeocodeLilongwe,
} from '@/lib/courier-geocode'

export const dynamic = 'force-dynamic'

/** Public Lilongwe geocode for Vero Courier (reverse GPS or forward place text). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const mode = String(body.mode || '').trim().toLowerCase()
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const label = String(body.label || body.q || '').trim()

    if (mode === 'reverse' || (Number.isFinite(lat) && Number.isFinite(lng) && !label)) {
      const point = await reverseGeocodeLilongwe(lat, lng)
      return NextResponse.json({ success: true, point, city: 'Lilongwe' })
    }

    const point = await forwardGeocodeLilongwe(label || String(body.address || ''))
    return NextResponse.json({ success: true, point, city: 'Lilongwe' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not resolve location' },
      { status: 400 },
    )
  }
}
