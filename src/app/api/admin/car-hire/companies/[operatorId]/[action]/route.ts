import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import type { CarHireCompanyReviewAction } from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

type Ctx = { params: Promise<{ operatorId: string; action: string }> }

const COMPANY_REVIEW_ACTIONS: CarHireCompanyReviewAction[] = [
  'approve',
  'reject',
  'request-info',
  'suspend',
  'restore',
]

function parseAction(raw: string): CarHireCompanyReviewAction | null {
  const value = raw.trim().toLowerCase()
  return (COMPANY_REVIEW_ACTIONS as string[]).includes(value)
    ? (value as CarHireCompanyReviewAction)
    : null
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { operatorId, action: rawAction } = await ctx.params

    const operator = operatorId.trim()
    if (!operator) {
      return NextResponse.json({ error: 'Invalid operator id' }, { status: 400 })
    }

    const action = parseAction(rawAction)
    if (!action) {
      return NextResponse.json(
        { error: `Unknown action. Use one of: ${COMPANY_REVIEW_ACTIONS.join(', ')}` },
        { status: 400 },
      )
    }

    const payload = (await request.json().catch(() => ({}))) as {
      note?: unknown
      actorLabel?: unknown
    }
    const note = typeof payload.note === 'string' ? payload.note.trim() : ''
    const requestedLabel =
      typeof payload.actorLabel === 'string' ? payload.actorLabel.trim() : ''
    const actorLabel = requestedLabel || actor.email || 'operations'

    const { res, error } = await nestOpsFetch(
      ['car-rental', 'operator-reviews', operator, action],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(note ? { note } : {}), actorLabel }),
      },
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire company action POST error:', err)
    return NextResponse.json({ error: 'Could not update car-hire company' }, { status: 502 })
  }
}
