import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  requirePanelAdmin,
  verifyPanelAdmin,
} from '@/lib/admin-auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  countAdmins,
  parsePanelAdmin,
} from '@/lib/admins'

/** Current signed-in panel admin (+ whether any admins exist yet). */
export async function GET(request: Request) {
  try {
    const db = getAdminDb()
    const existing = await db.collection(ADMINS_COLLECTION).limit(1).get()
    const needsBootstrap = existing.empty

    const actor = await verifyPanelAdmin(request)
    if (!actor) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          needsBootstrap,
          error: needsBootstrap
            ? 'No admins yet. Create the first super admin from /dashboard/admins.'
            : 'Not an active panel admin.',
        },
        { status: needsBootstrap ? 200 : 401 },
      )
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      needsBootstrap: false,
      me: actor.admin,
      canManage: actor.admin.role === 'super_admin',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin me GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resolve admin session' },
      { status: 502 },
    )
  }
}

/** Refresh session after login. */
export async function POST(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const snap = await getAdminDb().collection(ADMINS_COLLECTION).get()
    const admins = snap.docs.map(d =>
      parsePanelAdmin(d.id, d.data() as Record<string, unknown>),
    )
    return NextResponse.json({
      success: true,
      me: actor.admin,
      canManage: actor.admin.role === 'super_admin',
      counts: countAdmins(admins),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 502 },
    )
  }
}

type PatchBody = {
  displayName?: string
  password?: string
}

/**
 * Signed-in admin updates their own display name and/or password.
 * Password changes go through Firebase Auth Admin SDK (session already verified via Bearer token).
 */
export async function PATCH(request: Request) {
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const displayName =
    body.displayName !== undefined ? String(body.displayName).trim() : undefined
  const password =
    body.password !== undefined ? String(body.password) : undefined

  if (displayName === undefined && password === undefined) {
    return NextResponse.json(
      { error: 'Provide displayName and/or password to update' },
      { status: 400 },
    )
  }

  if (displayName !== undefined && displayName.length < 2) {
    return NextResponse.json(
      { error: 'Name must be at least 2 characters' },
      { status: 400 },
    )
  }

  if (password !== undefined && password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 },
    )
  }

  try {
    const actor = await requirePanelAdmin(request)
    const auth = getAdminAuth()
    const db = getAdminDb()
    const ref = db.collection(ADMINS_COLLECTION).doc(actor.uid)

    const authPatch: { displayName?: string; password?: string } = {}
    if (displayName !== undefined) authPatch.displayName = displayName
    if (password !== undefined) authPatch.password = password

    await auth.updateUser(actor.uid, authPatch)

    if (displayName !== undefined) {
      await ref.set(
        {
          displayName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    } else {
      await ref.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }

    const snap = await ref.get()
    const me = parsePanelAdmin(actor.uid, (snap.data() || {}) as Record<string, unknown>)

    const parts: string[] = []
    if (displayName !== undefined) parts.push('name')
    if (password !== undefined) parts.push('password')

    return NextResponse.json({
      success: true,
      me,
      message:
        parts.length === 2
          ? 'Name and password updated.'
          : parts[0] === 'name'
            ? 'Display name updated.'
            : 'Password updated.',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin me PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update profile' },
      { status: 502 },
    )
  }
}
