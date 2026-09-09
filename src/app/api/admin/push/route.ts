import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const COLLECTION = 'engagement_broadcasts'

function stringifyData(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) out[String(k)] = s
  }
  return out
}

/** Recent admin / engagement broadcasts. */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const snap = await getAdminDb()
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(40)
      .get()

    const items = snap.docs.map((d) => {
      const data = d.data() || {}
      const createdAt = data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt || null
      const sentAt = data.sentAt?.toDate?.()
        ? data.sentAt.toDate().toISOString()
        : data.sentAt || null
      return {
        id: d.id,
        title: String(data.title || ''),
        body: String(data.body || ''),
        type: String(data.type || 'engagement'),
        badgeRoute: String(data.badgeRoute || ''),
        target: String(data.target || ''),
        sent: data.sent === true,
        createdAt,
        sentAt,
        createdByEmail: String(data.createdByEmail || ''),
      }
    })

    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Admin push GET:', err)
    return NextResponse.json(
      { error: 'Failed to load push history' },
      { status: 500 },
    )
  }
}

/**
 * POST a push to everyone with the Vero360 app.
 * Writes Firestore `engagement_broadcasts` → Cloud Function sends FCM topic
 * `vero360_all` (+ engagement topic for older installs).
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const json = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!json) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const title = String(json.title || '').trim()
    const body = String(json.body || '').trim()
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!body) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }
    if (title.length > 120) {
      return NextResponse.json(
        { error: 'Title must be 120 characters or less' },
        { status: 400 },
      )
    }
    if (body.length > 500) {
      return NextResponse.json(
        { error: 'Body must be 500 characters or less' },
        { status: 400 },
      )
    }

    const badgeRoute = String(json.badgeRoute || 'notifications').trim()
    const extra = stringifyData(json.data)

    const doc = {
      title,
      body,
      type: 'admin_broadcast',
      target: 'all',
      badgeRoute: badgeRoute || 'notifications',
      ...extra,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: admin.uid,
      createdByEmail: admin.email || '',
      source: 'admin_panel',
      sent: false,
    }

    const ref = await getAdminDb().collection(COLLECTION).add(doc)

    return NextResponse.json({
      success: true,
      id: ref.id,
      message:
        'Push queued. Everyone subscribed to Vero360 will receive it shortly.',
    })
  } catch (err) {
    console.error('Admin push POST:', err)
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 },
    )
  }
}
