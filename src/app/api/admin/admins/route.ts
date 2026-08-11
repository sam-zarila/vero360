import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  claimsForRole,
  requireSuperAdminOrBootstrap,
  verifyPanelAdmin,
} from '@/lib/admin-auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  countAdmins,
  normalizeAdminRole,
  parsePanelAdmin,
  type AdminRole,
  type CreateAdminInput,
  type PanelAdmin,
} from '@/lib/admins'

export async function GET(request: Request) {
  try {
    // Listing does not require sign-in (so bootstrap + post-create refresh work).
    // Mutations still require super admin (or empty-collection bootstrap).
    const actor = await verifyPanelAdmin(request)
    const snap = await getAdminDb().collection(ADMINS_COLLECTION).get()
    const admins: PanelAdmin[] = snap.docs
      .map(d => parsePanelAdmin(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'super_admin' ? -1 : 1
        return a.email.localeCompare(b.email)
      })

    const bootstrap = admins.length === 0

    if (!bootstrap && actor?.admin.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can view admin accounts.' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      admins,
      counts: countAdmins(admins),
      me: actor?.admin ?? null,
      canManage: actor?.admin.role === 'super_admin' || bootstrap,
      needsSignIn: !actor && !bootstrap,
      bootstrap,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin admins GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load admins' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = (raw || {}) as CreateAdminInput
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const password = String(body.password || '')
  const displayName =
    String(body.displayName || '').trim() || email.split('@')[0] || 'Admin'
  let role: AdminRole = normalizeAdminRole(body.role || 'admin')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 },
    )
  }

  try {
    const { actor, bootstrap } = await requireSuperAdminOrBootstrap(request)
    if (bootstrap) {
      role = 'super_admin'
    }

    const auth = getAdminAuth()
    const db = getAdminDb()

    const dup = await db.collection(ADMINS_COLLECTION).where('email', '==', email).limit(1).get()
    if (!dup.empty) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 409 },
      )
    }

    let user
    try {
      user = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      })
    } catch (createErr: unknown) {
      const code =
        createErr && typeof createErr === 'object' && 'code' in createErr
          ? String((createErr as { code: unknown }).code)
          : ''
      if (code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(email)
        user = existing
        await auth.updateUser(existing.uid, {
          password,
          displayName,
          disabled: false,
        })
      } else {
        throw createErr
      }
    }

    await auth.setCustomUserClaims(user.uid, claimsForRole(role))

    await db.collection(ADMINS_COLLECTION).doc(user.uid).set({
      email,
      displayName,
      role,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: actor?.uid || 'bootstrap',
      lastLoginAt: null,
    })

    const snap = await db.collection(ADMINS_COLLECTION).doc(user.uid).get()
    const admin = parsePanelAdmin(user.uid, (snap.data() || {}) as Record<string, unknown>)

    return NextResponse.json(
      {
        success: true,
        admin,
        bootstrap,
        message: bootstrap
          ? 'First super admin created. Sign in at /panel with this email and password.'
          : `${role === 'super_admin' ? 'Super admin' : 'Admin'} created.`,
      },
      { status: 201 },
    )
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin admins POST error:', err)
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to create admin'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
