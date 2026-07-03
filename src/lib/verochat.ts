import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export const VEROCHAT_COLLECTION = 'verochat_sessions'
export const SESSION_STORAGE_KEY = 'verochat_session_id'

export type VeroChatSession = {
  visitorName: string
  visitorEmail: string
  status: 'open' | 'closed'
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessage: string
  unreadForAgent: number
}

export type VeroChatMessage = {
  text: string
  sender: 'visitor' | 'agent'
  agentName?: string
  createdAt: Timestamp
}

export type VeroChatMessageView = VeroChatMessage & { id: string }

export type VeroChatSessionView = VeroChatSession & { id: string }

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  }
  return id
}

function messagesRef(sessionId: string) {
  return collection(db, VEROCHAT_COLLECTION, sessionId, 'messages')
}

function sessionRef(sessionId: string) {
  return doc(db, VEROCHAT_COLLECTION, sessionId)
}

async function notifyAgent(payload: {
  type: 'new_chat' | 'new_message'
  sessionId: string
  visitorName: string
  visitorEmail: string
  message?: string
}) {
  try {
    await fetch('/api/verochat/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-blocking — chat still works if email fails
  }
}

export async function ensureSession(
  sessionId: string,
  visitorName: string,
  visitorEmail: string,
) {
  const ref = sessionRef(sessionId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    await setDoc(ref, {
      visitorName,
      visitorEmail,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      unreadForAgent: 0,
    })

    await addDoc(messagesRef(sessionId), {
      text: "Hi! I'm VeroChat — your Vero360 live agent. How can we help you today?",
      sender: 'agent',
      agentName: 'VeroChat',
      createdAt: serverTimestamp(),
    })

    notifyAgent({
      type: 'new_chat',
      sessionId,
      visitorName,
      visitorEmail,
    })
  }
}

export async function sendVisitorMessage(
  sessionId: string,
  text: string,
  visitor?: { name: string; email: string },
) {
  const trimmed = text.trim()
  if (!trimmed) return

  await addDoc(messagesRef(sessionId), {
    text: trimmed,
    sender: 'visitor',
    createdAt: serverTimestamp(),
  })

  await updateDoc(sessionRef(sessionId), {
    lastMessage: trimmed,
    updatedAt: serverTimestamp(),
    unreadForAgent: increment(1),
    status: 'open',
  })

  if (visitor) {
    notifyAgent({
      type: 'new_message',
      sessionId,
      visitorName: visitor.name,
      visitorEmail: visitor.email,
      message: trimmed,
    })
  }
}

export async function sendAgentMessage(
  sessionId: string,
  text: string,
  agentName = 'VeroChat Agent',
) {
  const trimmed = text.trim()
  if (!trimmed) return

  await addDoc(messagesRef(sessionId), {
    text: trimmed,
    sender: 'agent',
    agentName,
    createdAt: serverTimestamp(),
  })

  await updateDoc(sessionRef(sessionId), {
    lastMessage: trimmed,
    updatedAt: serverTimestamp(),
    unreadForAgent: 0,
  })
}

export async function markSessionRead(sessionId: string) {
  await updateDoc(sessionRef(sessionId), { unreadForAgent: 0 })
}

export function subscribeToMessages(
  sessionId: string,
  onMessages: (messages: VeroChatMessageView[]) => void,
): Unsubscribe {
  const q = query(messagesRef(sessionId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    onMessages(
      snap.docs.map(d => ({ id: d.id, ...(d.data() as VeroChatMessage) })),
    )
  })
}

export function subscribeToSessions(
  onSessions: (sessions: VeroChatSessionView[]) => void,
): Unsubscribe {
  const q = query(collection(db, VEROCHAT_COLLECTION), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, snap => {
    onSessions(
      snap.docs.map(d => ({ id: d.id, ...(d.data() as VeroChatSession) })),
    )
  })
}

export function formatChatTime(value: Timestamp | null | undefined) {
  if (!value?.toDate) return ''
  return value.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
