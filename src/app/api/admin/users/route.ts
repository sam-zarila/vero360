import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { countUsers, parseAppUser, USERS_COLLECTION } from '@/lib/users'

export async function GET() {
  try {
    const db = getAdminDb()
    const snap = await db.collection(USERS_COLLECTION).get()

    const users = snap.docs
      .map(docSnap => parseAppUser(docSnap.id, docSnap.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0
        const bt = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0
        return bt - at
      })

    return NextResponse.json({
      success: true,
      users,
      counts: countUsers(users),
    })
  } catch (err) {
    console.error('Admin users GET error:', err)
    const message =
      err instanceof Error ? err.message : 'Could not load users from Firebase'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
