import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  AGENT_REGISTRATIONS_COLLECTION,
  MERCHANT_SERVICES,
  countAgentRegistrations,
  formatPhoneE164,
  normalizeAgentUserRole,
  parseAgentRegistration,
  syntheticEmailForPhone,
  type AgentRegistration,
  type CreateAgentRegistrationInput,
  type MerchantServiceKey,
} from '@/lib/agent-registrations'
import { USERS_COLLECTION } from '@/lib/users'
import type { PanelAdmin } from '@/lib/admins'

const MIN_PASSWORD_LENGTH = 8

function generateTempPassword() {
  const chunk = () => Math.random().toString(36).slice(2, 6)
  return `Vero${chunk()}${chunk()}9!`
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isPhoneAuthEmail(email: string) {
  return email.toLowerCase().endsWith('@phone.vero360.app')
}

function normalizeMerchantService(raw: unknown): MerchantServiceKey | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (MERCHANT_SERVICES.some(s => s.key === v)) return v as MerchantServiceKey
  return null
}

function merchantShopCollection(service: MerchantServiceKey) {
  return service === 'marketplace' ? 'marketplace_merchants' : `${service}_merchants`
}

function validateSignupPassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (/^(.)\1+$/.test(password)) return 'Don’t repeat the same character'
  const common = new Set([
    'password',
    'password1',
    'password12',
    'password123',
    '12345678',
    '123456789',
    'vero3601',
    'vero3608',
    '11111111',
    '00000000',
  ])
  if (common.has(password.toLowerCase())) {
    return 'This password is too common. Choose a stronger one'
  }
  return null
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

/**
 * Creates a real Vero360 account the same way the mobile app does:
 * Firebase Auth user + Firestore `users/{uid}` (+ merchant shop doc when needed).
 */
export async function createAgentRegistration(
  input: CreateAgentRegistrationInput,
  agent: PanelAdmin,
) {
  const name = String(input.name || '').trim()
  const rawEmail = String(input.email || '')
    .trim()
    .toLowerCase()
  const rawPhone = String(input.phone || '').trim()
  const role = normalizeAgentUserRole(input.role)
  const useTemp = input.generateTempPassword === true
  const password = useTemp
    ? generateTempPassword()
    : String(input.password || '')
  const verificationTicket = String(input.verificationTicket || '').trim()
  const preferredVerification = String(input.preferredVerification || '')
    .trim()
    .toLowerCase()
  const businessName = String(input.businessName || '').trim()
  const businessAddress = String(input.businessAddress || '').trim()
  const merchantService = normalizeMerchantService(input.merchantService)
  // Contact OTP verification counts as verified identity for agent onboarding.
  const isVerified = input.isVerified === true || Boolean(verificationTicket)

  const geo = {
    lat:
      input.geo?.lat == null || Number.isNaN(Number(input.geo.lat))
        ? null
        : Number(input.geo.lat),
    lng:
      input.geo?.lng == null || Number.isNaN(Number(input.geo.lng))
        ? null
        : Number(input.geo.lng),
    label: String(input.geo?.label || '').trim(),
  }
  if (geo.lat != null && !Number.isFinite(geo.lat)) geo.lat = null
  if (geo.lng != null && !Number.isFinite(geo.lng)) geo.lng = null

  if (!name) throw new Error('Name is required')
  if (!verificationTicket) {
    throw new Error('Verify email or phone with OTP before creating the account')
  }

  const hasEmail = rawEmail.length > 0 && isValidEmail(rawEmail) && !isPhoneAuthEmail(rawEmail)
  const hasPhone = rawPhone.replace(/\D/g, '').length >= 9
  if (!hasEmail && !hasPhone) {
    throw new Error('Email or phone number is required (same as app signup)')
  }

  if (!useTemp) {
    const passwordErr = validateSignupPassword(password)
    if (passwordErr) throw new Error(passwordErr)
  }

  if (role === 'merchant') {
    if (!merchantService) {
      throw new Error('Merchant service is required (marketplace, food, or accommodation)')
    }
    if (!businessName) throw new Error('Business name is required for merchants')
  }

  const phone = hasPhone ? formatPhoneE164(rawPhone) : ''
  // App: Firebase Auth always needs an email; phone-only uses synthetic address.
  const authEmail = hasEmail ? rawEmail : syntheticEmailForPhone(phone)
  const contactEmail = hasEmail ? rawEmail : ''
  const displayEmail = contactEmail || (isPhoneAuthEmail(authEmail) ? '' : authEmail)

  const auth = getAdminAuth()
  const db = getAdminDb()

  // Reject duplicate phone profiles (app looks up by phone too).
  if (phone) {
    const phoneSnap = await db
      .collection(USERS_COLLECTION)
      .where('phone', '==', phone)
      .limit(1)
      .get()
    if (!phoneSnap.empty) {
      throw new Error('A user with this phone already exists')
    }
  }

  let user
  try {
    user = await auth.createUser({
      email: authEmail,
      password,
      displayName: name,
      emailVerified: isVerified && hasEmail,
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
    throw createErr
  }

  const now = FieldValue.serverTimestamp()

  // Mirror Vero360App AuthService._saveFirebaseProfile + register_screen profile.
  const userDoc: Record<string, unknown> = {
    email: authEmail,
    name,
    phone: phone || null,
    role,
    authProvider: 'firebase_only',
    accountStatus: 'active',
    createdAt: now,
    updatedAt: now,
    registeredAt: now,
    // Agent attribution (extra; does not break app)
    registeredByAgentId: agent.id,
    registeredByAgentName: agent.displayName,
    registeredByAgentEmail: agent.email,
    agentUid: agent.id,
    agentName: agent.displayName,
    agentEmail: agent.email,
    isVerified,
    preferredVerification:
      preferredVerification === 'email' || preferredVerification === 'phone'
        ? preferredVerification
        : hasEmail
          ? 'email'
          : 'phone',
    registrationVerified: true,
    verificationTicket,
  }

  if (contactEmail && contactEmail !== authEmail) {
    userDoc.contactEmail = contactEmail
  }

  if (geo.lat != null || geo.lng != null || geo.label) {
    userDoc.geo = geo
  }

  if (role === 'merchant' && merchantService) {
    userDoc.merchantService = merchantService
    userDoc.serviceType = merchantService
    userDoc.businessName = businessName
    userDoc.businessAddress = businessAddress
    userDoc.status = 'pending'
    userDoc.isActive = false
  }

  await db.collection(USERS_COLLECTION).doc(user.uid).set(userDoc, { merge: true })

  // Mirror register_screen._writeChosenMerchantShop
  if (role === 'merchant' && merchantService) {
    const shopName = businessName || name
    const shopCollection = merchantShopCollection(merchantService)
    await db.collection(shopCollection).doc(user.uid).set(
      {
        uid: user.uid,
        email: displayEmail || authEmail,
        name: shopName,
        merchantName: shopName,
        phone: phone || null,
        ownerName: name,
        businessName,
        businessAddress,
        merchantService,
        serviceType: merchantService,
        status: 'pending',
        isActive: false,
        createdAt: now,
        updatedAt: now,
        rating: 0,
        totalRatings: 0,
        completedOrders: 0,
        registeredByAgentId: agent.id,
        registeredByAgentName: agent.displayName,
      },
      { merge: true },
    )
  }

  const regRef = db.collection(AGENT_REGISTRATIONS_COLLECTION).doc()
  await regRef.set({
    userId: user.uid,
    name,
    email: displayEmail || authEmail,
    phone: phone || '',
    role,
    businessName: businessName || null,
    businessAddress: businessAddress || null,
    merchantService: merchantService || null,
    isVerified,
    geo,
    registeredAt: now,
    agentUid: agent.id,
    agentName: agent.displayName,
    agentEmail: agent.email,
    registeredByAgentId: agent.id,
    registeredByAgentName: agent.displayName,
    registeredByAgentEmail: agent.email,
    authEmail,
    createdAt: now,
    updatedAt: now,
  })

  const snap = await regRef.get()
  return {
    registration: parseAgentRegistration(regRef.id, (snap.data() || {}) as Record<string, unknown>),
    /** Only returned when a temp password was generated — never echo user-chosen passwords. */
    tempPassword: useTemp ? password : null,
    usedTempPassword: useTemp,
    userId: user.uid,
    authEmail,
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
