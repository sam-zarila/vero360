import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  CAR_HIRE_MODERATION_ACTIONS,
  type CarHireModerationAction,
} from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

type Ctx = { params: Promise<{ carId: string; action: string }> }

function parseCarId(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const id = Number(raw.trim())
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseAction(raw: string): CarHireModerationAction | null {
  const value = raw.trim().toLowerCase()
  return (CAR_HIRE_MODERATION_ACTIONS as string[]).includes(value)
    ? (value as CarHireModerationAction)
    : null
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { carId, action: rawAction } = await ctx.params

    const id = parseCarId(carId)
    if (id == null) {
      return NextResponse.json({ error: 'Invalid car id' }, { status: 400 })
    }

    const action = parseAction(rawAction)
    if (!action) {
      return NextResponse.json(
        {
          error: `Unknown action. Use one of: ${CAR_HIRE_MODERATION_ACTIONS.join(', ')}`,
        },
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
      ['car-rental', 'moderation', 'listings', id, action],
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
    console.error('Admin car-hire listing action POST error:', err)
    return NextResponse.json({ error: 'Could not update car-hire listing' }, { status: 502 })
  }
}
