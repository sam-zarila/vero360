import { NextResponse } from 'next/server'
import { trackNestCourier } from '@/lib/courier-public'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = String(searchParams.get('code') || searchParams.get('tracking') || '')
    const delivery = await trackNestCourier(code)
    return NextResponse.json({ success: true, delivery })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not track parcel' },
      { status: 400 },
    )
  }
}
