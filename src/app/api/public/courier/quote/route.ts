import { NextResponse } from 'next/server'
import { estimateCourierPrice, isLilongweCity, COURIER_CITY } from '@/lib/courier-pricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const city = String(body.city || COURIER_CITY)
    if (!isLilongweCity(city)) {
      return NextResponse.json(
        { error: 'Vero Courier is currently Lilongwe only.' },
        { status: 400 },
      )
    }
    const quote = estimateCourierPrice({
      distanceKm: Number(body.distanceKm) || 3,
      goodsType: String(body.goodsType || 'Other'),
      description: String(body.description || ''),
    })
    return NextResponse.json({ success: true, city: COURIER_CITY, quote })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not quote' },
      { status: 400 },
    )
  }
}
