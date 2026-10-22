import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  CAR_HIRE_LISTING_STATUSES,
  parseOpsListingPage,
  type CarHireListingStatus,
} from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

const DEFAULT_STATUS: CarHireListingStatus = 'PENDING_REVIEW'

function requestedStatus(request: Request): CarHireListingStatus | null {
  const raw = (new URL(request.url).searchParams.get('status') || '').trim().toUpperCase()
  if (!raw) return DEFAULT_STATUS
  return (CAR_HIRE_LISTING_STATUSES as readonly string[]).includes(raw)
    ? (raw as CarHireListingStatus)
    : null
}

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const status = requestedStatus(request)
    if (!status) {
      return NextResponse.json(
        { error: `Unknown status. Use one of: ${CAR_HIRE_LISTING_STATUSES.join(', ')}` },
        { status: 400 },
      )
    }

    const qs = new URLSearchParams({ status })
    const { res, body, error } = await nestOpsFetch(
      ['car-rental', 'moderation', `listings?${qs.toString()}`],
      undefined,
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    const { items, counts } = parseOpsListingPage(body)
    return NextResponse.json({ success: true, items, counts })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire listings GET error:', err)
    return NextResponse.json({ error: 'Could not reach car-hire moderation API' }, { status: 502 })
  }
}
