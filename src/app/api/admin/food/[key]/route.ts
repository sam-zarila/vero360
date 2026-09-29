import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ key: string }> }

function parseKey(key: string): { source: string; rawId: string } | null {
  const decoded = decodeURIComponent(key)
  const idx = decoded.indexOf(':')
  if (idx <= 0) return null
  return {
    source: decoded.slice(0, idx),
    rawId: decoded.slice(idx + 1),
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { key } = await ctx.params
  const parsed = parseKey(key)
  if (!parsed?.rawId) {
    return NextResponse.json({ error: 'Invalid food item key' }, { status: 400 })
  }

  const { source, rawId } = parsed

  try {
    if (source === 'marketplace') {
      await getAdminDb().collection('marketplace_items').doc(rawId).delete()
      return NextResponse.json({ success: true, deleted: true })
    }

    if (source === 'menu') {
      await getAdminDb().collection('food_menu_items').doc(rawId).delete()
      return NextResponse.json({ success: true, deleted: true })
    }

    if (source === 'api') {
      const auth = getVeroAuthHeader(request)
      if (!auth) {
        return NextResponse.json(
          {
            error:
              'Admin API token missing. Add VERO_API_TOKEN to .env.local to delete marketplace API items.',
          },
          { status: 401 },
        )
      }
      const res = await fetch(veroEndpoint('marketplace', rawId), {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: auth },
      })
      const data = await readJsonSafe(res)
      if (!res.ok) {
        return NextResponse.json(
          { error: apiErrorMessage(data, 'Failed to delete marketplace item') },
          { status: res.status },
        )
      }
      return NextResponse.json({ success: true, deleted: true })
    }

    return NextResponse.json({ error: `Unsupported source: ${source}` }, { status: 400 })
  } catch (err) {
    console.error('Admin food DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete food item' },
      { status: 502 },
    )
  }
}
