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
    const res = await fetch(veroEndpoint('promos', id, 'deactivate'), {
      method: 'PATCH',
      headers: { Accept: 'application/json', Authorization: auth },
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to deactivate promotion') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin promo deactivate error:', err)
    return NextResponse.json({ error: 'Could not deactivate promotion' }, { status: 502 })
  }
}
