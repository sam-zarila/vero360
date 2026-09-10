import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin'

export const ENGAGEMENT_BROADCASTS_COLLECTION = 'engagement_broadcasts'

/** Same topics as Flutter Cloud Function `onEngagementBroadcast`. */
export const ALL_USERS_TOPIC = 'vero360_all'
export const ENGAGEMENT_TOPIC = 'vero360_engagement'

export type BroadcastFcmResult = {
  topic: string
  messageId?: string
  error?: string
}

/**
 * Send an admin / engagement broadcast via FCM topics (everyone).
 * Mirrors Vero360App functions `onEngagementBroadcast`.
 */
export async function sendBroadcastToTopics(opts: {
  title: string
  body: string
  type?: string
  badgeRoute?: string
  target?: string
  extra?: Record<string, string>
}): Promise<{
  topics: string[]
  results: BroadcastFcmResult[]
  successCount: number
  isAdminBroadcast: boolean
}> {
  const title = opts.title.trim() || 'Vero360'
  const body =
    opts.body.trim() || 'Something new is waiting for you on Vero360.'
  const type = (opts.type || 'admin_broadcast').trim() || 'admin_broadcast'
  const badgeRoute = (opts.badgeRoute || '').trim()
  const target = (opts.target || '').trim().toLowerCase()
  const isAdminBroadcast =
    type === 'admin_broadcast' ||
    type === 'admin' ||
    target === 'all' ||
    target === 'everyone'

  const data: Record<string, string> = {
    type,
    title,
    body,
  }
  if (badgeRoute) data.badgeRoute = badgeRoute
  for (const [k, v] of Object.entries(opts.extra || {})) {
    const key = String(k).trim()
    const val = String(v ?? '').trim()
    if (key && val) data[key] = val
  }

  const messageBase = {
    notification: { title, body },
    data,
    android: {
      priority: (isAdminBroadcast ? 'high' : 'normal') as 'high' | 'normal',
      notification: {
        channelId: 'high_importance_channel',
        sound: 'default',
        priority: (isAdminBroadcast ? 'high' : 'default') as 'high' | 'default',
      },
    },
    apns: {
      headers: {
        'apns-priority': isAdminBroadcast ? '10' : '5',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  }

  const topics = isAdminBroadcast
    ? [ALL_USERS_TOPIC, ENGAGEMENT_TOPIC]
    : [ENGAGEMENT_TOPIC]

  const messaging = getAdminMessaging()
  const results: BroadcastFcmResult[] = []

  for (const topic of topics) {
    try {
      const messageId = await messaging.send({ ...messageBase, topic })
      results.push({ topic, messageId })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`Broadcast FCM failed for topic ${topic}:`, error)
      results.push({ topic, error })
    }
  }

  return {
    topics,
    results,
    successCount: results.filter(r => r.messageId).length,
    isAdminBroadcast,
  }
}

/** Persist FCM outcome on an engagement_broadcasts doc. */
export async function markBroadcastSent(
  id: string,
  outcome: {
    topics: string[]
    results: BroadcastFcmResult[]
    successCount: number
  },
) {
  const sent = outcome.successCount > 0
  await getAdminDb()
    .collection(ENGAGEMENT_BROADCASTS_COLLECTION)
    .doc(id)
    .set(
      {
        sent,
        sentAt: sent ? FieldValue.serverTimestamp() : null,
        topics: outcome.topics,
        fcmResults: outcome.results,
        fcmError: sent
          ? null
          : outcome.results.map(r => r.error).filter(Boolean).join('; ') ||
            'FCM send failed',
      },
      { merge: true },
    )
  return sent
}
