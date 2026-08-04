import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { ACCOMMODATION_ROOMS_COLLECTION } from '@/lib/stay-rooms'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

/** Admin delete — same Nest path the app uses for owner delete, via admin bypass. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid accommodation id' }, { status: 400 })
  }

  try {
    const res = await fetch(veroEndpoint('accommodations', 'admin', id), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        {
          error: apiErrorMessage(
            data,
            'Failed to delete listing. Redeploy vero-backend with DELETE /accommodations/admin/:id if this is 404.',
          ),
        },
        { status: res.status },
      )
    }

    // Best-effort: remove Firestore room overlay docs tied to this API id
    try {
      const db = getAdminDb()
      const col = db.collection(ACCOMMODATION_ROOMS_COLLECTION)
      const qs = await col.where('apiAccommodationId', '==', id).limit(20).get()
      await Promise.all(qs.docs.map(d => d.ref.delete()))
      // Also try common doc id pattern `{uid}_{apiId}`
      const all = await col.get()
      await Promise.all(
        all.docs
          .filter(d => d.id.endsWith(`_${id}`))
          .map(d => d.ref.delete()),
      )
    } catch (err) {
      console.warn('Stay room Firestore cleanup skipped:', err)
    }

    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error('Admin stay DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete accommodation' },
      { status: 502 },
    )
  }
}
