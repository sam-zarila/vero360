import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'
import { VEROCHAT_COLLECTION } from '@/lib/verochat'

function iso(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

export type SerializedVeroChatSession = {
  id: string
  visitorName: string
  visitorEmail: string
  status: 'open' | 'closed'
  lastMessage: string
  unreadForAgent: number
  type?: string
  source?: string
  createdAt: string | null
  updatedAt: string | null
}

export type SerializedVeroChatMessage = {
  id: string
  text: string
  sender: 'visitor' | 'agent'
  agentName?: string
  createdAt: string | null
  kind: 'text' | 'image'
  imageUrl?: string
  replyTo?: {
    messageId: string
    text: string
    sender: 'visitor' | 'agent'
  }
}

export async function listVeroChatSessions(limit = 200): Promise<SerializedVeroChatSession[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(VEROCHAT_COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()

  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      visitorName: String(data.visitorName ?? ''),
      visitorEmail: String(data.visitorEmail ?? ''),
      status: data.status === 'closed' ? 'closed' : 'open',
      lastMessage: String(data.lastMessage ?? ''),
      unreadForAgent: Number(data.unreadForAgent ?? 0) || 0,
      type: data.type ? String(data.type) : undefined,
      source: data.source ? String(data.source) : undefined,
      createdAt: iso(data.createdAt),
      updatedAt: iso(data.updatedAt),
    }
  })
}

export async function listVeroChatMessages(
  sessionId: string,
  limit = 500,
): Promise<SerializedVeroChatMessage[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(VEROCHAT_COLLECTION)
    .doc(sessionId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get()

  return snap.docs.map(d => {
    const data = d.data()
    const replyRaw = data.replyTo
    let replyTo: SerializedVeroChatMessage['replyTo']
    if (replyRaw && typeof replyRaw === 'object') {
      const r = replyRaw as Record<string, unknown>
      const messageId = String(r.messageId ?? '').trim()
      if (messageId) {
        replyTo = {
          messageId,
          text: String(r.text ?? '').trim(),
          sender: r.sender === 'agent' ? 'agent' : 'visitor',
        }
      }
    }
    return {
      id: d.id,
      text: String(data.text ?? ''),
      sender: data.sender === 'agent' ? 'agent' : 'visitor',
      agentName: data.agentName ? String(data.agentName) : undefined,
      createdAt: iso(data.createdAt),
      kind: data.kind === 'image' ? 'image' : 'text',
      imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
      replyTo,
    }
  })
}
