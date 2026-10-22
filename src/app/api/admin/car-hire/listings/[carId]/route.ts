import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseOpsListingDetail } from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

type Ctx = { params: Promise<{ carId: string }> }

function parseCarId(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const id = Number(raw.trim())
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { carId } = await ctx.params
    const id = parseCarId(carId)
    if (id == null) {
      return NextResponse.json({ error: 'Invalid car id' }, { status: 400 })
    }

    const { res, body, error } = await nestOpsFetch(
      ['car-rental', 'moderation', 'listings', id],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const parsed = parseOpsListingDetail(body)
    if (!parsed) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      listing: parsed.listing,
      events: parsed.events,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire listing GET error:', err)
    return NextResponse.json({ error: 'Could not reach car-hire moderation API' }, { status: 502 })
  }
}
