import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { sendBroadcastToTopics } from '@/lib/admin-push'

export const VERO_TEAM_BROADCASTS_COLLECTION = 'vero_team_broadcasts'

export type VeroTeamBroadcastKind = 'general' | 'app_update'

export type VeroTeamBroadcast = {
  id: string
  title: string
  body: string
  kind: VeroTeamBroadcastKind
  createdAt: string | null
  createdByEmail: string | null
  fcmSent: boolean
  fcmError: string | null
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

export async function listVeroTeamBroadcasts(limit = 30): Promise<VeroTeamBroadcast[]> {
  const snap = await getAdminDb()
    .collection(VERO_TEAM_BROADCASTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(80, Math.max(1, limit)))
    .get()

  return snap.docs.map(doc => {
    const d = doc.data() || {}
    const kindRaw = String(d.kind || 'general').trim().toLowerCase()
    return {
      id: doc.id,
      title: String(d.title || ''),
      body: String(d.body || ''),
      kind: kindRaw === 'app_update' ? 'app_update' : 'general',
      createdAt: tsToIso(d.createdAt),
      createdByEmail: d.createdByEmail ? String(d.createdByEmail) : null,
      fcmSent: d.fcmSent === true,
      fcmError: d.fcmError ? String(d.fcmError) : null,
    }
  })
}

/**
 * Post a Vero360 Team chat message for everyone + push notification.
 * App reads `vero_team_broadcasts` into the Team chat thread.
 * FCM opens that chat when tapped (`openChat: vero360_team`).
 */
export async function sendVeroTeamBroadcast(input: {
  title: string
  body: string
  kind?: VeroTeamBroadcastKind
  updatedByEmail?: string | null
}): Promise<{
  broadcast: VeroTeamBroadcast
  fcmSuccessCount: number
  topics: string[]
}> {
  const title = (input.title || '').trim() || 'Vero360 Team'
  const body = (input.body || '').trim()
  if (!body) throw new Error('Message body is required')
  if (title.length > 120) throw new Error('Title must be 120 characters or less')
  if (body.length > 2000) throw new Error('Message must be 2000 characters or less')

  const kind: VeroTeamBroadcastKind =
    input.kind === 'app_update' ? 'app_update' : 'general'

  const ref = getAdminDb().collection(VERO_TEAM_BROADCASTS_COLLECTION).doc()
  await ref.set({
    title,
    body,
    kind,
    from: 'vero360_team',
    createdAt: FieldValue.serverTimestamp(),
    createdByEmail: (input.updatedByEmail || '').trim() || null,
    source: 'admin_panel',
    fcmSent: false,
  })

  const outcome = await sendBroadcastToTopics({
    title,
    body,
    type: 'vero_team',
    badgeRoute: kind === 'app_update' ? 'app_update' : 'vero_team',
    target: 'all',
    extra: {
      openChat: 'vero360_team',
      broadcastId: ref.id,
      kind,
    },
  })

  const fcmSent = outcome.successCount > 0
  const fcmError = fcmSent
    ? null
    : outcome.results.map(r => r.error).filter(Boolean).join('; ') ||
      'FCM send failed'

  await ref.set(
    {
      fcmSent,
      fcmError,
      fcmResults: outcome.results,
      topics: outcome.topics,
      sentAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  const snap = await ref.get()
  const d = snap.data() || {}
  return {
    broadcast: {
      id: ref.id,
      title: String(d.title || title),
      body: String(d.body || body),
      kind,
      createdAt: tsToIso(d.createdAt) || new Date().toISOString(),
      createdByEmail: d.createdByEmail ? String(d.createdByEmail) : null,
      fcmSent,
      fcmError,
    },
    fcmSuccessCount: outcome.successCount,
    topics: outcome.topics,
  }
}
