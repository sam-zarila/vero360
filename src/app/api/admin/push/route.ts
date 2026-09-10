import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  ENGAGEMENT_BROADCASTS_COLLECTION,
  markBroadcastSent,
  sendBroadcastToTopics,
} from '@/lib/admin-push'

export const dynamic = 'force-dynamic'

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
      .collection(ENGAGEMENT_BROADCASTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(40)
      .get()

    const items = snap.docs.map(d => {
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
        fcmError: data.fcmError ? String(data.fcmError) : null,
        topics: Array.isArray(data.topics) ? data.topics.map(String) : [],
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
 * Writes Firestore + sends FCM topics immediately (vero360_all + vero360_engagement).
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

    // Retry a stuck queued broadcast
    if (json.action === 'retry' && typeof json.id === 'string') {
      const id = json.id.trim()
      const snap = await getAdminDb()
        .collection(ENGAGEMENT_BROADCASTS_COLLECTION)
        .doc(id)
        .get()
      if (!snap.exists) {
        return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
      }
      const data = snap.data() || {}
      if (data.sent === true) {
        return NextResponse.json({
          success: true,
          id,
          alreadySent: true,
          message: 'This push was already sent.',
        })
      }

      const title = String(data.title || '').trim()
      const body = String(data.body || '').trim()
      const outcome = await sendBroadcastToTopics({
        title,
        body,
        type: String(data.type || 'admin_broadcast'),
        badgeRoute: String(data.badgeRoute || ''),
        target: String(data.target || 'all'),
      })
      const sent = await markBroadcastSent(id, outcome)
      if (!sent) {
        return NextResponse.json(
          {
            error:
              outcome.results.map(r => r.error).filter(Boolean).join('; ') ||
              'FCM send failed — check Firebase Messaging credentials',
            id,
            fcmResults: outcome.results,
          },
          { status: 502 },
        )
      }
      return NextResponse.json({
        success: true,
        id,
        sent: true,
        topics: outcome.topics,
        fcmResults: outcome.results,
        message: 'Push sent to everyone on Vero360.',
      })
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
    const type = 'admin_broadcast'
    const target = 'all'

    const doc = {
      title,
      body,
      type,
      target,
      badgeRoute: badgeRoute || 'notifications',
      ...extra,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: admin.uid,
      createdByEmail: admin.email || '',
      source: 'admin_panel',
      sent: false,
    }

    const ref = await getAdminDb().collection(ENGAGEMENT_BROADCASTS_COLLECTION).add(doc)

    const outcome = await sendBroadcastToTopics({
      title,
      body,
      type,
      badgeRoute,
      target,
      extra,
    })
    const sent = await markBroadcastSent(ref.id, outcome)

    if (!sent) {
      return NextResponse.json(
        {
          error:
            outcome.results.map(r => r.error).filter(Boolean).join('; ') ||
            'Saved, but FCM send failed — use Retry on the queued item',
          id: ref.id,
          sent: false,
          fcmResults: outcome.results,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      id: ref.id,
      sent: true,
      topics: outcome.topics,
      fcmResults: outcome.results,
      message: 'Push sent to everyone on Vero360 (topics vero360_all + vero360_engagement).',
    })
  } catch (err) {
    console.error('Admin push POST:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to send push notification',
      },
      { status: 500 },
    )
  }
}
