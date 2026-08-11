import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  applyContactProfile,
  cleanContactEmail,
  cleanContactPhone,
  type ContactProfile,
  type MarketplaceOrder,
} from '@/lib/orders'
import { USERS_COLLECTION } from '@/lib/users'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function profileFromFirestore(data: Record<string, unknown>): ContactProfile {
  return {
    name:
      str(data.name) ||
      str(data.displayName) ||
      str(data.fullName) ||
      str(data.businessName) ||
      null,
    phone: cleanContactPhone(str(data.phone) || str(data.phoneNumber)),
    email: cleanContactEmail(str(data.contactEmail) || str(data.email)),
  }
}

async function loadProfile(uid: string): Promise<ContactProfile | null> {
  const clean = uid.trim()
  if (!clean) return null

  let fromFs: ContactProfile | null = null
  try {
    const snap = await getAdminDb().collection(USERS_COLLECTION).doc(clean).get()
    if (snap.exists) {
      fromFs = profileFromFirestore(snap.data() as Record<string, unknown>)
    }
  } catch (err) {
    console.warn('[order-contacts] Firestore lookup failed', clean, err)
  }

  let fromAuth: ContactProfile | null = null
  try {
    const user = await getAdminAuth().getUser(clean)
    fromAuth = {
      name: str(user.displayName) || null,
      phone: cleanContactPhone(user.phoneNumber),
      email: cleanContactEmail(user.email),
    }
  } catch {
    // Auth user may not exist for this uid
  }

  if (!fromFs && !fromAuth) return null

  return {
    name: fromFs?.name || fromAuth?.name || null,
    phone: fromFs?.phone || fromAuth?.phone || null,
    email: fromFs?.email || fromAuth?.email || null,
  }
}

/**
 * Fill missing / placeholder buyer & seller phone/email from Firestore + Auth.
 */
export async function enrichOrderContacts(
  orders: MarketplaceOrder[],
): Promise<MarketplaceOrder[]> {
  if (orders.length === 0) return orders

  const uids = new Set<string>()
  for (const o of orders) {
    if (o.customerFirebaseUid && (!o.customerPhone || !o.customerEmail)) {
      uids.add(o.customerFirebaseUid)
    }
    if (o.merchantFirebaseUid && (!o.merchantPhone || !o.merchantEmail)) {
      uids.add(o.merchantFirebaseUid)
    }
  }

  const cache = new Map<string, ContactProfile | null>()
  await Promise.all(
    [...uids].map(async uid => {
      cache.set(uid, await loadProfile(uid))
    }),
  )

  return orders.map(order => {
    let next = order
    if (order.customerFirebaseUid) {
      next = applyContactProfile(next, 'customer', cache.get(order.customerFirebaseUid))
    }
    if (order.merchantFirebaseUid) {
      next = applyContactProfile(next, 'merchant', cache.get(order.merchantFirebaseUid))
    }
    return next
  })
}
