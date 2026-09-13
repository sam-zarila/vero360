import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)
  if (!auth) {
    return NextResponse.json({ error: 'Admin API token missing.' }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      price?: number
      title?: string
      description?: string | null
      isActive?: boolean
    } | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (body.price != null) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      patch.price = Math.round(price)
    }
    if (typeof body.title === 'string' && body.title.trim()) {
      patch.title = body.title.trim()
    }
    if (body.description !== undefined) {
      patch.description =
        body.description == null ? null : String(body.description)
    }
    if (typeof body.isActive === 'boolean') {
      patch.isActive = body.isActive
      patch.active = body.isActive
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const res = await fetch(veroEndpoint('promos', id), {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      // Fallback PUT for backends that reject PATCH body shapes.
      const putRes = await fetch(veroEndpoint('promos', id), {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      })
      const putData = await readJsonSafe(putRes)
      if (!putRes.ok) {
        return NextResponse.json(
          { error: apiErrorMessage(putData, apiErrorMessage(data, 'Failed to update promotion')) },
          { status: putRes.status || res.status },
        )
      }
      return NextResponse.json({ success: true, promo: putData })
    }
    return NextResponse.json({ success: true, promo: data })
  } catch (err) {
    console.error('Admin promo PATCH error:', err)
    return NextResponse.json({ error: 'Could not update promotion' }, { status: 502 })
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)
  if (!auth) {
    return NextResponse.json({ error: 'Admin API token missing.' }, { status: 401 })
  }

  try {
    const res = await fetch(veroEndpoint('promos', id), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: auth },
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to delete promotion') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin promo DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete promotion' }, { status: 502 })
  }
}
