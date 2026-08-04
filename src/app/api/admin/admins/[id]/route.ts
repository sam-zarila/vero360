import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  claimsForRole,
  requireSuperAdmin,
} from '@/lib/admin-auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  normalizeAdminRole,
  parsePanelAdmin,
  type AdminRole,
} from '@/lib/admins'
import { verifyFirebasePassword } from '@/lib/verify-firebase-password'

type Ctx = { params: Promise<{ id: string }> }

type PatchBody = {
  action?: 'suspend' | 'activate' | 'set_role'
  role?: AdminRole | string
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Admin id required' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'suspend' && action !== 'activate' && action !== 'set_role') {
    return NextResponse.json(
      { error: 'action must be suspend, activate, or set_role' },
      { status: 400 },
    )
  }

  try {
    const actor = await requireSuperAdmin(request)
    if (actor.uid === id && action === 'suspend') {
      return NextResponse.json(
        { error: 'You cannot suspend your own account.' },
        { status: 400 },
      )
    }

    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection(ADMINS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const current = parsePanelAdmin(id, (snap.data() || {}) as Record<string, unknown>)

    if (action === 'set_role') {
      const role = normalizeAdminRole(body.role || 'admin')
      if (actor.uid === id && role !== 'super_admin') {
        return NextResponse.json(
          { error: 'You cannot demote your own super admin role.' },
          { status: 400 },
        )
      }
      // Many super admins are allowed; only block demoting the last active one.
      if (current.role === 'super_admin' && role === 'admin') {
        const supers = await db
          .collection(ADMINS_COLLECTION)
          .where('role', '==', 'super_admin')
          .get()
        const activeSupers = supers.docs.filter(d => {
          const s = String((d.data() as { status?: string }).status || 'active')
          return s !== 'suspended' && d.id !== id
        })
        if (activeSupers.length === 0) {
          return NextResponse.json(
            { error: 'At least one active super admin is required.' },
            { status: 400 },
          )
        }
      }

      await ref.set(
        { role, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
      try {
        await auth.setCustomUserClaims(id, claimsForRole(role))
      } catch (err) {
        console.warn('setCustomUserClaims skipped:', err)
      }
    } else {
      const suspended = action === 'suspend'
      if (current.role === 'super_admin' && suspended) {
        const supers = await db
          .collection(ADMINS_COLLECTION)
          .where('role', '==', 'super_admin')
          .get()
        const others = supers.docs.filter(d => {
          const s = String((d.data() as { status?: string }).status || 'active')
          return d.id !== id && s !== 'suspended'
        })
        if (others.length === 0) {
          return NextResponse.json(
            { error: 'Cannot suspend the last active super admin.' },
            { status: 400 },
          )
        }
      }

      await ref.set(
        {
          status: suspended ? 'suspended' : 'active',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      try {
        await auth.updateUser(id, { disabled: suspended })
      } catch (err) {
        console.warn('Auth disable/enable skipped:', err)
      }
    }

    const updated = await ref.get()
    const admin = parsePanelAdmin(id, (updated.data() || {}) as Record<string, unknown>)
    return NextResponse.json({
      success: true,
      admin,
      message:
        action === 'suspend'
          ? 'Admin suspended — cannot sign in to the panel.'
          : action === 'activate'
            ? 'Admin activated — can sign in again.'
            : `Role updated to ${admin.role === 'super_admin' ? 'super admin' : 'admin'}.`,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin admins PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update admin' },
      { status: 502 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Admin id required' }, { status: 400 })
  }

  let password = ''
  try {
    const body = (await request.json()) as { password?: string }
    password = String(body.password || '')
  } catch {
    // no body
  }

  if (!password) {
    return NextResponse.json(
      { error: 'Enter your current password to delete an admin.' },
      { status: 400 },
    )
  }

  try {
    const actor = await requireSuperAdmin(request)
    if (actor.uid === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 },
      )
    }

    const ok = await verifyFirebasePassword(actor.email, password)
    if (!ok) {
      return NextResponse.json(
        { error: 'Your current password is incorrect.' },
        { status: 403 },
      )
    }

    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection(ADMINS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const current = parsePanelAdmin(id, (snap.data() || {}) as Record<string, unknown>)
    // Many super admins allowed; only block deleting the final one.
    if (current.role === 'super_admin') {
      const supers = await db
        .collection(ADMINS_COLLECTION)
        .where('role', '==', 'super_admin')
        .get()
      if (supers.size <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last super admin.' },
          { status: 400 },
        )
      }
    }

    await ref.delete()
    try {
      await auth.deleteUser(id)
    } catch (err) {
      console.warn('Auth delete skipped:', err)
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Deleted admin ${current.email}`,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin admins DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete admin' },
      { status: 502 },
    )
  }
}
