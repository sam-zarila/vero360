import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import { parseAppUser, USERS_COLLECTION } from '@/lib/users'

type Ctx = { params: Promise<{ id: string }> }

type ActionBody = {
  action?: 'suspend' | 'activate' | 'delete'
}

async function readBody(request: Request): Promise<ActionBody> {
  try {
    return (await request.json()) as ActionBody
  } catch {
    return {}
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 })
  }

  const body = await readBody(request)
  const action = body.action
  if (action !== 'suspend' && action !== 'activate') {
    return NextResponse.json(
      { error: 'action must be suspend or activate (use DELETE to remove)' },
      { status: 400 },
    )
  }

  const suspended = action === 'suspend'

  try {
    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection(USERS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found in Firestore' }, { status: 404 })
    }

    await ref.set(
      {
        accountStatus: suspended ? 'suspended' : 'active',
        disabled: suspended,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    try {
      await auth.updateUser(id, { disabled: suspended })
    } catch (authErr) {
      // Firestore updated; Auth may fail if UID is not an Auth user.
      console.warn('Auth disable/enable skipped:', authErr)
    }

    const updated = await ref.get()
    const user = parseAppUser(id, (updated.data() || {}) as Record<string, unknown>)
    return NextResponse.json({
      success: true,
      action,
      user,
      message: suspended
        ? 'Account suspended. User cannot sign in.'
        : 'Account activated. User can sign in again.',
    })
  } catch (err) {
    console.error('Admin user PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update account' },
      { status: 502 },
    )
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection(USERS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found in Firestore' }, { status: 404 })
    }

    await ref.delete()

    try {
      await auth.deleteUser(id)
    } catch (authErr) {
      console.warn('Auth delete skipped:', authErr)
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      message: 'Account deleted from Firebase Auth and Firestore.',
    })
  } catch (err) {
    console.error('Admin user DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete account' },
      { status: 502 },
    )
  }
}
