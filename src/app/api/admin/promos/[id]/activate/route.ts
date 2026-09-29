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
    // Prefer dedicated activate route; fall back to isActive patch.
    let res = await fetch(veroEndpoint('promos', id, 'activate'), {
      method: 'PATCH',
      headers: { Accept: 'application/json', Authorization: auth },
    })
    let data = await readJsonSafe(res)
    if (!res.ok) {
      res = await fetch(veroEndpoint('promos', id), {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true, active: true, status: 'active' }),
      })
      data = await readJsonSafe(res)
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to activate promotion') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin promo activate error:', err)
    return NextResponse.json({ error: 'Could not activate promotion' }, { status: 502 })
  }
}
