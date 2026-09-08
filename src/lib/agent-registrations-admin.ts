import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  AGENT_REGISTRATIONS_COLLECTION,
  countAgentRegistrations,
  normalizeAgentUserRole,
  parseAgentRegistration,
  type AgentRegistration,
  type CreateAgentRegistrationInput,
} from '@/lib/agent-registrations'
import { USERS_COLLECTION } from '@/lib/users'
import type { PanelAdmin } from '@/lib/admins'

function randomTempPassword() {
  return `Vero${Math.random().toString(36).slice(2, 8)}${Math.floor(100 + Math.random() * 900)}!`
}

export async function listAgentRegistrations(opts?: {
  agentUid?: string | null
}): Promise<AgentRegistration[]> {
  const db = getAdminDb()
  let snap
  if (opts?.agentUid) {
    snap = await db
      .collection(AGENT_REGISTRATIONS_COLLECTION)
      .where('agentUid', '==', opts.agentUid)
      .get()
  } else {
    snap = await db.collection(AGENT_REGISTRATIONS_COLLECTION).get()
  }

  return snap.docs
    .map(d => parseAgentRegistration(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => {
      const at = a.registeredAt ? new Date(a.registeredAt).getTime() : 0
      const bt = b.registeredAt ? new Date(b.registeredAt).getTime() : 0
      return bt - at
    })
}

export async function listAgentRegistrationsPayload(opts?: { agentUid?: string | null }) {
  const items = await listAgentRegistrations(opts)
  return { items, counts: countAgentRegistrations(items) }
}

export async function createAgentRegistration(
  input: CreateAgentRegistrationInput,
  agent: PanelAdmin,
) {
  const name = String(input.name || '').trim()
  const email = String(input.email || '')
    .trim()
    .toLowerCase()
  const phone = String(input.phone || '').trim()
  const role = normalizeAgentUserRole(input.role)
  const businessName = String(input.businessName || '').trim() || null
  const isVerified = input.isVerified === true
  const password = String(input.password || '').trim() || randomTempPassword()
  const geo = {
    lat:
      input.geo?.lat == null || input.geo.lat === ('' as unknown)
        ? null
        : Number(input.geo.lat),
    lng:
      input.geo?.lng == null || input.geo.lng === ('' as unknown)
        ? null
        : Number(input.geo.lng),
    label: String(input.geo?.label || '').trim(),
  }
  if (geo.lat != null && !Number.isFinite(geo.lat)) geo.lat = null
  if (geo.lng != null && !Number.isFinite(geo.lng)) geo.lng = null

  if (!name) throw new Error('Name is required')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Valid email is required')
  }
  if (!phone) throw new Error('Phone number is required')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')
  if (role === 'merchant' && !businessName) {
    throw new Error('Business name is required for merchants')
  }

  const auth = getAdminAuth()
  const db = getAdminDb()

  let user
  try {
    user = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone.startsWith('+') ? phone : undefined,
      emailVerified: isVerified,
      disabled: false,
    })
  } catch (createErr: unknown) {
    const code =
      createErr && typeof createErr === 'object' && 'code' in createErr
        ? String((createErr as { code: unknown }).code)
        : ''
    if (code === 'auth/email-already-exists') {
      throw new Error('A user with this email already exists')
    }
    if (code === 'auth/invalid-phone-number') {
      // Retry without phone — Malawi numbers may need E.164 formatting.
      user = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: isVerified,
        disabled: false,
      })
    } else {
      throw createErr
    }
  }

  const now = FieldValue.serverTimestamp()
  const userDoc = {
    name,
    displayName: name,
    email,
    phone,
    phoneNumber: phone,
    role,
    businessName,
    status: role === 'merchant' ? 'pending' : 'active',
    accountStatus: 'active',
    authProvider: 'email',
    isVerified,
    emailVerified: isVerified,
    geo,
    registeredByAgentId: agent.id,
    registeredByAgentName: agent.displayName,
    registeredByAgentEmail: agent.email,
    agentUid: agent.id,
    agentName: agent.displayName,
    agentEmail: agent.email,
    createdAt: now,
    registeredAt: now,
    updatedAt: now,
  }

  await db.collection(USERS_COLLECTION).doc(user.uid).set(userDoc, { merge: true })

  const regRef = db.collection(AGENT_REGISTRATIONS_COLLECTION).doc()
  await regRef.set({
    userId: user.uid,
    name,
    email,
    phone,
    role,
    businessName,
    isVerified,
    geo,
    registeredAt: now,
    agentUid: agent.id,
    agentName: agent.displayName,
    agentEmail: agent.email,
    registeredByAgentId: agent.id,
    registeredByAgentName: agent.displayName,
    registeredByAgentEmail: agent.email,
    createdAt: now,
    updatedAt: now,
  })

  const snap = await regRef.get()
  return {
    registration: parseAgentRegistration(regRef.id, (snap.data() || {}) as Record<string, unknown>),
    tempPassword: password,
    userId: user.uid,
  }
}

export async function setAgentRegistrationVerified(id: string, isVerified: boolean) {
  const db = getAdminDb()
  const ref = db.collection(AGENT_REGISTRATIONS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Registration not found')
  const data = snap.data() as Record<string, unknown>
  await ref.update({
    isVerified,
    updatedAt: FieldValue.serverTimestamp(),
  })
  const userId = String(data.userId || '').trim()
  if (userId) {
    await db.collection(USERS_COLLECTION).doc(userId).set(
      {
        isVerified,
        emailVerified: isVerified,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
  const next = await ref.get()
  return parseAgentRegistration(id, (next.data() || {}) as Record<string, unknown>)
}
