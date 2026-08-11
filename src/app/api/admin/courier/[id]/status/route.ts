import { NextResponse } from 'next/server'
import { isCourierStatus, parseCourierDeliveries } from '@/lib/courier'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status =
    body && typeof body === 'object' && 'status' in body
      ? String((body as { status: unknown }).status || '')
      : ''

  if (!isCourierStatus(status)) {
    return NextResponse.json(
      { error: 'status must be PENDING, ACCEPTED, ON_THE_WAY, DELIVERED, or CANCELLED' },
      { status: 400 },
    )
  }

  try {
    const headers: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('verocourier', 'deliveries', id, 'status'), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to update delivery status') },
        { status: res.status },
      )
    }

    const [item] = parseCourierDeliveries([data])
    return NextResponse.json({ success: true, item: item || data })
  } catch (err) {
    console.error('Admin courier status PATCH error:', err)
    return NextResponse.json({ error: 'Could not update delivery status' }, { status: 502 })
  }
}
