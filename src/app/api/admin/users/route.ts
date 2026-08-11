import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  countUsers,
  mergeAuthIntoUser,
  parseAppUser,
  USERS_COLLECTION,
  type AppUser,
} from '@/lib/users'

const AUTH_BATCH = 100

async function enrichFromFirebaseAuth(users: AppUser[]): Promise<AppUser[]> {
  if (users.length === 0) return users

  const auth = getAdminAuth()
  const byId = new Map(users.map(u => [u.id, u]))

  // Prefer enriching rows that look empty (typical Google/Apple Firestore stubs).
  const needsEnrich = users.filter(
    u => !u.email || !u.name || u.name === '—' || !u.phone || u.authProvider === 'unknown',
  )
  const ids = (needsEnrich.length ? needsEnrich : users).map(u => u.id)

  for (let i = 0; i < ids.length; i += AUTH_BATCH) {
    const chunk = ids.slice(i, i + AUTH_BATCH)
    try {
      const result = await auth.getUsers(chunk.map(uid => ({ uid })))
      for (const record of result.users) {
        const existing = byId.get(record.uid)
        if (!existing) continue
        byId.set(
          record.uid,
          mergeAuthIntoUser(existing, {
            displayName: record.displayName,
            email: record.email,
            phoneNumber: record.phoneNumber,
            photoURL: record.photoURL,
            disabled: record.disabled,
            providerIds: record.providerData.map(p => p.providerId),
            creationTime: record.metadata.creationTime || null,
          }),
        )
      }
    } catch (err) {
      console.warn('Firebase Auth enrich batch failed:', err)
    }
  }

  return users.map(u => byId.get(u.id) || u)
}

export async function GET() {
  try {
    const db = getAdminDb()
    const snap = await db.collection(USERS_COLLECTION).get()

    let users = snap.docs.map(docSnap =>
      parseAppUser(docSnap.id, docSnap.data() as Record<string, unknown>),
    )

    try {
      users = await enrichFromFirebaseAuth(users)
    } catch (err) {
      console.warn('User Auth enrichment skipped:', err)
    }

    users.sort((a, b) => {
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
