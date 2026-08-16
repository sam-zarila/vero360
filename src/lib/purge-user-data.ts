import 'server-only'

import { type DocumentReference, type Query } from 'firebase-admin/firestore'
import {
  getAdminAuth,
  getAdminDb,
  getAdminStorage,
  getAdminStorageBucket,
} from '@/lib/firebase-admin'
import { MARKETPLACE_ITEMS_COLLECTION } from '@/lib/marketplace'
import { USERS_COLLECTION } from '@/lib/users'
import { nestAdminHeaders } from '@/lib/nest-admin'
import {
  apiErrorMessage,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

export type PurgeUserDataResult = {
  uid: string
  nestUserIds: number[]
  deleted: Record<string, number>
  warnings: string[]
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

async function deleteDocBestEffort(ref: DocumentReference, counts: Record<string, number>, key: string) {
  try {
    const snap = await ref.get()
    if (!snap.exists) return
    await ref.delete()
    counts[key] = (counts[key] || 0) + 1
  } catch (err) {
    console.warn(`[purgeUserData] doc ${ref.path}:`, err)
  }
}

async function deleteQueryDocs(
  query: Query,
  counts: Record<string, number>,
  key: string,
  onDoc?: (data: Record<string, unknown>, id: string) => void,
) {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const snap = await query.limit(400).get()
      if (snap.empty) break
      const batch = getAdminDb().batch()
      for (const doc of snap.docs) {
        onDoc?.((doc.data() || {}) as Record<string, unknown>, doc.id)
        batch.delete(doc.ref)
      }
      await batch.commit()
      counts[key] = (counts[key] || 0) + snap.size
      if (snap.size < 400) break
    }
  } catch (err) {
    console.warn(`[purgeUserData] query ${key}:`, err)
  }
}

async function deleteSubcollection(
  parent: DocumentReference,
  name: string,
  counts: Record<string, number>,
  key: string,
) {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const snap = await parent.collection(name).limit(400).get()
      if (snap.empty) break
      const batch = getAdminDb().batch()
      for (const doc of snap.docs) batch.delete(doc.ref)
      await batch.commit()
      counts[key] = (counts[key] || 0) + snap.size
      if (snap.size < 400) break
    }
  } catch (err) {
    console.warn(`[purgeUserData] subcollection ${parent.path}/${name}:`, err)
  }
}

async function deleteStoragePrefix(prefix: string, warnings: string[]) {
  try {
    const bucket = getAdminStorage().bucket(getAdminStorageBucket())
    const [files] = await bucket.getFiles({ prefix: prefix.replace(/\/?$/, '/') })
    await Promise.all(
      files.map(async file => {
        try {
          await file.delete({ ignoreNotFound: true })
        } catch {
          // ignore single-file failures
        }
      }),
    )
  } catch (err) {
    warnings.push(`storage:${prefix}`)
    console.warn(`[purgeUserData] storage ${prefix}:`, err)
  }
}

async function softDeleteNestListing(sqlId: number, warnings: string[]) {
  try {
    const res = await fetch(veroEndpoint('marketplace', 'admin', sqlId), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok && res.status !== 404) {
      const data = await readJsonSafe(res)
      warnings.push(
        apiErrorMessage(data, `Nest marketplace admin delete failed for ${sqlId}`),
      )
    }
  } catch (err) {
    warnings.push(`nest-listing:${sqlId}`)
    console.warn('[purgeUserData] nest listing:', err)
  }
}

async function adminPurgeNestUser(opts: {
  firebaseUid: string
  email?: string
  phone?: string
  warnings: string[]
}): Promise<number[]> {
  const params = new URLSearchParams()
  if (opts.firebaseUid) params.set('firebaseUid', opts.firebaseUid)
  if (opts.email) params.set('email', opts.email)
  if (opts.phone) params.set('phone', opts.phone)

  try {
    const res = await fetch(`${veroEndpoint('users', 'admin', 'purge')}?${params}`, {
      method: 'DELETE',
      headers: nestAdminHeaders(),
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      opts.warnings.push(apiErrorMessage(body, `Nest admin purge failed (${res.status})`))
      return []
    }
    const ids = Array.isArray((body as { deletedIds?: unknown }).deletedIds)
      ? (body as { deletedIds: unknown[] }).deletedIds
          .map(v => Number(v))
          .filter(n => Number.isFinite(n) && n > 0)
      : []
    const extraWarnings = (body as { warnings?: unknown }).warnings
    if (Array.isArray(extraWarnings)) {
      for (const w of extraWarnings) {
        if (typeof w === 'string' && w.trim()) opts.warnings.push(w)
      }
    }
    return ids
  } catch (err) {
    opts.warnings.push('nest-admin-purge')
    console.warn('[purgeUserData] nest admin purge:', err)
    return []
  }
}

/**
 * Cascade-delete marketplace listings, carts, merchant profiles, wallets, etc.
 * Mirrors Flutter `AccountDataPurge` so admin delete removes the same data.
 */
export async function purgeUserData(uid: string): Promise<PurgeUserDataResult> {
  const cleanUid = uid.trim()
  if (!cleanUid) throw new Error('User id required')

  const db = getAdminDb()
  const deleted: Record<string, number> = {}
  const warnings: string[] = []
  const nestListingIds = new Set<number>()

  const userRef = db.collection(USERS_COLLECTION).doc(cleanUid)
  const userSnap = await userRef.get()
  const userData = (userSnap.data() || {}) as Record<string, unknown>
  let email =
    str(userData.contactEmail) ||
    str(userData.email) ||
    str(userData.Email) ||
    str(userData.userEmail)
  let phone =
    str(userData.phone) ||
    str(userData.phoneNumber) ||
    str(userData.mobile) ||
    str(userData.Phone)

  const knownNestIds = new Set<number>()
  const fromDoc =
    Number(userData.backendUserId ?? userData.nestUserId ?? userData.userId) || 0
  if (fromDoc > 0) knownNestIds.add(fromDoc)

  try {
    const authUser = await getAdminAuth().getUser(cleanUid)
    email = email || str(authUser.email)
    phone = phone || str(authUser.phoneNumber)
    const claimId = Number(
      (authUser.customClaims as { nestUserId?: unknown; userId?: unknown } | undefined)
        ?.nestUserId ??
        (authUser.customClaims as { userId?: unknown } | undefined)?.userId,
    )
    if (Number.isFinite(claimId) && claimId > 0) knownNestIds.add(claimId)
  } catch {
    // Auth user may already be missing
  }

  if (email.toLowerCase().endsWith('@phone.vero360.app') || email.toLowerCase().includes('firebase')) {
    email = ''
  }
  if (phone.toLowerCase().includes('firebase')) {
    phone = ''
  }

  const purgedNestIds = await adminPurgeNestUser({
    firebaseUid: cleanUid,
    email: email || undefined,
    phone: phone || undefined,
    warnings,
  })
  for (const id of purgedNestIds) knownNestIds.add(id)
  const nestIds = [...knownNestIds]

  const noteListingSql = (data: Record<string, unknown>) => {
    const raw =
      data.sqlItemId ?? data.backendId ?? data.itemId ?? data.apiItemId ?? data.id
    const n =
      typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d]/g, ''))
    if (Number.isFinite(n) && n > 0) nestListingIds.add(n)
  }

  // Marketplace listings owned by this Firebase uid
  await deleteQueryDocs(
    db.collection(MARKETPLACE_ITEMS_COLLECTION).where('merchantId', '==', cleanUid),
    deleted,
    'marketplace_items',
    noteListingSql,
  )
  await deleteQueryDocs(
    db.collection(MARKETPLACE_ITEMS_COLLECTION).where('sellerUserId', '==', cleanUid),
    deleted,
    'marketplace_items',
    noteListingSql,
  )

  for (const nestUserId of nestIds) {
    await deleteQueryDocs(
      db.collection(MARKETPLACE_ITEMS_COLLECTION).where('sellerUserId', '==', nestUserId),
      deleted,
      'marketplace_items',
      noteListingSql,
    )
    await deleteQueryDocs(
      db
        .collection(MARKETPLACE_ITEMS_COLLECTION)
        .where('sellerUserId', '==', String(nestUserId)),
      deleted,
      'marketplace_items',
      noteListingSql,
    )
  }

  for (const sqlId of nestListingIds) {
    await softDeleteNestListing(sqlId, warnings)
  }

  // Merchant profile docs
  for (const col of [
    'marketplace_merchants',
    'food_merchants',
    'accommodation_merchants',
    'courier_merchants',
    'merchant_wallets',
    'wallets',
    'profiles',
  ] as const) {
    await deleteDocBestEffort(db.collection(col).doc(cleanUid), deleted, col)
  }

  // Wallets keyed by userId (doc id may differ from uid)
  await deleteQueryDocs(
    db.collection('wallets').where('userId', '==', cleanUid),
    deleted,
    'wallets',
  )

  await deleteQueryDocs(
    db.collection('merchant_stories').where('merchantId', '==', cleanUid),
    deleted,
    'merchant_stories',
  )
  await deleteQueryDocs(
    db.collection('accommodation_rooms').where('merchantId', '==', cleanUid),
    deleted,
    'accommodation_rooms',
  )
  await deleteQueryDocs(
    db.collection('accommodation_reviews').where('merchantId', '==', cleanUid),
    deleted,
    'accommodation_reviews',
  )
  await deleteQueryDocs(
    db.collection('food_menu_items').where('merchantId', '==', cleanUid),
    deleted,
    'food_menu_items',
  )
  await deleteQueryDocs(
    db.collection('latestarrivals').where('merchantId', '==', cleanUid),
    deleted,
    'latestarrivals',
  )
  await deleteQueryDocs(
    db.collection('wallet_transactions').where('merchantId', '==', cleanUid),
    deleted,
    'wallet_transactions',
  )
  await deleteQueryDocs(
    db.collection('wallet_transactions').where('userId', '==', cleanUid),
    deleted,
    'wallet_transactions',
  )
  await deleteQueryDocs(
    db.collection('order_escrow').where('buyerUid', '==', cleanUid),
    deleted,
    'order_escrow',
  )
  await deleteQueryDocs(
    db.collection('order_escrow').where('merchantId', '==', cleanUid),
    deleted,
    'order_escrow',
  )
  await deleteQueryDocs(
    db.collection('merchant_reports').where('merchantId', '==', cleanUid),
    deleted,
    'merchant_reports',
  )
  await deleteQueryDocs(
    db.collection('merchant_reports').where('reporterUid', '==', cleanUid),
    deleted,
    'merchant_reports',
  )
  await deleteQueryDocs(
    db.collection('merchant_reports').where('reporterId', '==', cleanUid),
    deleted,
    'merchant_reports',
  )
  await deleteQueryDocs(
    db.collection('refund_requests').where('buyerUid', '==', cleanUid),
    deleted,
    'refund_requests',
  )
  await deleteQueryDocs(
    db.collection('refund_requests').where('merchantUid', '==', cleanUid),
    deleted,
    'refund_requests',
  )

  // Chat threads (app uses Firebase uid OR Nest numeric id as participant)
  const threadKeys = [...new Set([cleanUid, ...nestIds.map(String), ...(email ? [email] : [])])]
  for (const key of threadKeys) {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snap = await db
          .collection('threads')
          .where('participantsAppIds', 'array-contains', key)
          .limit(50)
          .get()
        if (snap.empty) break
        for (const doc of snap.docs) {
          await deleteSubcollection(doc.ref, 'messages', deleted, 'thread_messages')
          await doc.ref.delete()
          deleted.threads = (deleted.threads || 0) + 1
        }
        if (snap.size < 50) break
      }
    } catch (err) {
      console.warn('[purgeUserData] threads:', err)
    }
  }

  await deleteQueryDocs(
    db.collection('bookings').where('customerId', '==', cleanUid),
    deleted,
    'bookings',
  )
  await deleteQueryDocs(
    db.collection('bookings').where('userId', '==', cleanUid),
    deleted,
    'bookings',
  )
  await deleteQueryDocs(
    db.collection('orders').where('customerFirebaseUid', '==', cleanUid),
    deleted,
    'orders',
  )
  await deleteQueryDocs(
    db.collection('orders').where('buyerUid', '==', cleanUid),
    deleted,
    'orders',
  )
  if (email) {
    await deleteQueryDocs(
      db.collection(USERS_COLLECTION).where('email', '==', email),
      deleted,
      USERS_COLLECTION,
    )
    await deleteQueryDocs(
      db.collection(USERS_COLLECTION).where('contactEmail', '==', email),
      deleted,
      USERS_COLLECTION,
    )
  }

  // Cart backups (uid + email key fallback used by CartService)
  await deleteSubcollection(db.collection('backup_carts').doc(cleanUid), 'items', deleted, 'backup_carts_items')
  await deleteDocBestEffort(db.collection('backup_carts').doc(cleanUid), deleted, 'backup_carts')
  if (email) {
    await deleteSubcollection(db.collection('backup_carts').doc(email), 'items', deleted, 'backup_carts_items')
    await deleteDocBestEffort(db.collection('backup_carts').doc(email), deleted, 'backup_carts')
  }

  // Merchant follower graph
  const followersRoot = db.collection('merchant_followers').doc(cleanUid)
  await deleteSubcollection(followersRoot, 'followers', deleted, 'merchant_followers')
  await deleteDocBestEffort(followersRoot, deleted, 'merchant_followers')

  // User subcollections then profile
  await deleteSubcollection(userRef, 'followed_merchants', deleted, 'followed_merchants')
  await deleteSubcollection(userRef, 'notifications', deleted, 'user_notifications')
  await deleteSubcollection(userRef, 'fcmTokens', deleted, 'fcmTokens')
  await deleteDocBestEffort(userRef, deleted, USERS_COLLECTION)

  await deleteStoragePrefix(`merchant_stories/${cleanUid}`, warnings)
  await deleteStoragePrefix(`profiles/${cleanUid}`, warnings)
  await deleteStoragePrefix(`marketplace/${cleanUid}`, warnings)

  return {
    uid: cleanUid,
    nestUserIds: nestIds,
    deleted,
    warnings,
  }
}
