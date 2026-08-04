import type { DecodedIdToken } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  isConfiguredSuperAdminEmail,
  normalizeAdminRole,
  parsePanelAdmin,
  type AdminRole,
  type PanelAdmin,
} from '@/lib/admins'

export type VerifiedPanelAdmin = {
  token: DecodedIdToken
  uid: string
  email: string
  admin: PanelAdmin
}

function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m?.[1]?.trim() || null
}

/**
 * Ensure Firestore admin row exists for this Auth user.
 * Auto-provisions configured super-admin emails and first-login bootstrap.
 */
export async function ensureAdminProfile(opts: {
  uid: string
  email: string
  displayName?: string | null
}): Promise<PanelAdmin | null> {
  const db = getAdminDb()
  const ref = db.collection(ADMINS_COLLECTION).doc(opts.uid)
  const snap = await ref.get()
  if (snap.exists) {
    return parsePanelAdmin(opts.uid, (snap.data() || {}) as Record<string, unknown>)
  }

  const email = opts.email.trim().toLowerCase()
  if (!email) return null

  const configured = isConfiguredSuperAdminEmail(email)
  const existing = await db.collection(ADMINS_COLLECTION).limit(1).get()
  const isFirstAdmin = existing.empty

  // Only auto-create for configured super emails, or the very first admin account.
  if (!configured && !isFirstAdmin) return null

  const role: AdminRole = configured || isFirstAdmin ? 'super_admin' : 'admin'
  const displayName =
    (opts.displayName || '').trim() || email.split('@')[0] || 'Admin'

  await ref.set({
    email,
    displayName,
    role,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'system_bootstrap',
    lastLoginAt: FieldValue.serverTimestamp(),
  })

  try {
    await getAdminAuth().setCustomUserClaims(opts.uid, {
      panel: true,
      panelRole: role,
    })
  } catch (err) {
    console.warn('setCustomUserClaims skipped:', err)
  }

  const fresh = await ref.get()
  return parsePanelAdmin(opts.uid, (fresh.data() || {}) as Record<string, unknown>)
}

export async function verifyPanelAdmin(
  request: Request,
): Promise<VerifiedPanelAdmin | null> {
  const tokenStr = bearerToken(request)
  if (!tokenStr) return null

  try {
    const auth = getAdminAuth()
    const token = await auth.verifyIdToken(tokenStr)
    const uid = token.uid
    const email = (token.email || '').trim().toLowerCase()

    let admin = await ensureAdminProfile({
      uid,
      email,
      displayName: token.name || null,
    })

    if (!admin) {
      // Fallback: lookup by email if doc id mismatched
      if (email) {
        const qs = await getAdminDb()
          .collection(ADMINS_COLLECTION)
          .where('email', '==', email)
          .limit(1)
          .get()
        if (!qs.empty) {
          const doc = qs.docs[0]!
          admin = parsePanelAdmin(doc.id, doc.data() as Record<string, unknown>)
        }
      }
    }

    if (!admin) return null
    if (admin.status === 'suspended') return null

    // Touch last login (best-effort)
    try {
      await getAdminDb().collection(ADMINS_COLLECTION).doc(admin.id).set(
        { lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    } catch {
      // ignore
    }

    return { token, uid: admin.id, email: admin.email || email, admin }
  } catch (err) {
    console.warn('verifyPanelAdmin failed:', err)
    return null
  }
}

export async function requirePanelAdmin(request: Request): Promise<VerifiedPanelAdmin> {
  const v = await verifyPanelAdmin(request)
  if (!v) {
    throw new AuthError(401, 'Sign in required. Use an active admin account.')
  }
  return v
}

export async function requireSuperAdmin(request: Request): Promise<VerifiedPanelAdmin> {
  const v = await requirePanelAdmin(request)
  if (v.admin.role !== 'super_admin') {
    throw new AuthError(403, 'Only super admins can manage admin accounts.')
  }
  return v
}

/**
 * Dev-friendly: allow unauthenticated super actions only when there are zero admins
 * (bootstrap). Otherwise require a verified super admin token.
 */
export async function requireSuperAdminOrBootstrap(
  request: Request,
): Promise<{ actor: VerifiedPanelAdmin | null; bootstrap: boolean }> {
  const db = getAdminDb()
  const existing = await db.collection(ADMINS_COLLECTION).limit(1).get()
  const bootstrap = existing.empty

  const actor = await verifyPanelAdmin(request)
  if (actor?.admin.role === 'super_admin') {
    return { actor, bootstrap: false }
  }

  if (bootstrap) {
    return { actor: null, bootstrap: true }
  }

  if (!actor) {
    throw new AuthError(401, 'Sign in as a super admin to manage admins.')
  }
  throw new AuthError(403, 'Only super admins can manage admin accounts.')
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return { status: err.status, error: err.message }
  }
  return null
}

export function claimsForRole(role: AdminRole) {
  return {
    panel: true,
    panelRole: normalizeAdminRole(role),
  }
}
