import { NextResponse } from 'next/server'
import type { CollectionReference } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { MARKETPLACE_ITEMS_COLLECTION } from '@/lib/marketplace'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ key: string }> }

/**
 * Remove an inappropriate listing.
 * - Firestore docs: delete `marketplace_items/{docId}` (and soft-delete Nest if sqlId known)
 * - API-only: `api:{sqlId}` → Nest admin delete
 */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { key: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey || '').trim()
  if (!key) {
    return NextResponse.json({ error: 'Invalid listing key' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const col = db.collection(MARKETPLACE_ITEMS_COLLECTION)

    if (key.startsWith('api:')) {
      const sqlId = Number(key.slice(4))
      if (!Number.isFinite(sqlId) || sqlId <= 0) {
        return NextResponse.json({ error: 'Invalid API listing id' }, { status: 400 })
      }
      await deleteNestListing(sqlId)
      await cleanupFirestoreMirrors(col, sqlId, null)
      return NextResponse.json({ success: true, deleted: true, key })
    }

    const docRef = col.doc(key)
    const snap = await docRef.get()
    let sqlId: number | null = null
    if (snap.exists) {
      const data = snap.data() as Record<string, unknown>
      const raw =
        data.sqlItemId ?? data.backendId ?? data.itemId ?? data.apiItemId ?? data.id
      const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d]/g, ''))
      if (Number.isFinite(n) && n > 0) sqlId = n
      await docRef.delete()
    } else {
      const asNum = Number(key)
      if (Number.isFinite(asNum) && asNum > 0) sqlId = asNum
    }

    if (sqlId) {
      await deleteNestListing(sqlId).catch(err => {
        console.warn('Nest marketplace admin delete skipped:', err)
      })
      await cleanupFirestoreMirrors(col, sqlId, key)
    }

    return NextResponse.json({ success: true, deleted: true, key, sqlId })
  } catch (err) {
    console.error('Admin marketplace DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete listing' },
      { status: 502 },
    )
  }
}

async function deleteNestListing(sqlId: number) {
  const res = await fetch(veroEndpoint('marketplace', 'admin', sqlId), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const data = await readJsonSafe(res)
  if (!res.ok && res.status !== 404) {
    throw new Error(
      apiErrorMessage(
        data,
        'Failed to delete Nest listing. Redeploy vero-backend with DELETE /marketplace/admin/:id if needed.',
      ),
    )
  }
}

async function cleanupFirestoreMirrors(
  col: CollectionReference,
  sqlId: number,
  exceptDocId: string | null,
) {
  try {
    const qs = await col.where('sqlItemId', '==', sqlId).limit(20).get()
    await Promise.all(
      qs.docs.filter(d => d.id !== exceptDocId).map(d => d.ref.delete()),
    )
  } catch {
    // ignore query/index issues
  }
  try {
    const qs = await col.where('apiItemId', '==', sqlId).limit(20).get()
    await Promise.all(
      qs.docs.filter(d => d.id !== exceptDocId).map(d => d.ref.delete()),
    )
  } catch {
    // ignore
  }
}
