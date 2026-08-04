import { NextResponse } from 'next/server'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)
  if (!auth) {
    return NextResponse.json(
      {
        error:
          'Admin API token missing. Add VERO_API_TOKEN to .env.local to delete latest arrivals.',
      },
      { status: 401 },
    )
  }

  try {
    const res = await fetch(veroEndpoint('latestarrivals', id), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: auth },
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to delete latest arrival') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin latest arrival DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete latest arrival' }, { status: 502 })
  }
}
