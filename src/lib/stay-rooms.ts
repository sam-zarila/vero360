import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  applyRoomMeta,
  type RoomMeta,
  type StayListing,
} from '@/lib/stay'
import { cleanContactEmail, cleanContactPhone } from '@/lib/orders'
import { USERS_COLLECTION } from '@/lib/users'

/** Same collection as the Flutter accommodation merchant dashboard. */
export const ACCOMMODATION_ROOMS_COLLECTION = 'accommodation_rooms'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function metaFromDoc(data: Record<string, unknown>): RoomMeta {
  const period = str(data.pricingPeriod ?? data.pricePeriod).toLowerCase() || null
  const capacityRaw = num(data.capacity ?? data.roomsAvailable)
  const available =
    typeof data.isAvailable === 'boolean'
      ? data.isAvailable
      : data.isAvailable == null
        ? null
        : Boolean(data.isAvailable)

  return {
    pricingPeriod: period,
    capacity: capacityRaw > 0 ? capacityRaw : null,
    isAvailable: available,
    hostelGender: str(data.hostelGender).toLowerCase() || null,
    roomType: str(data.roomType).toLowerCase() || null,
  }
}

async function loadContact(uid: string): Promise<{
  name: string | null
  phone: string | null
  email: string | null
} | null> {
  const clean = uid.trim()
  if (!clean) return null

  let name: string | null = null
  let phone: string | null = null
  let email: string | null = null

  try {
    const snap = await getAdminDb().collection(USERS_COLLECTION).doc(clean).get()
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>
      name = str(d.name) || str(d.displayName) || str(d.businessName) || null
      phone = cleanContactPhone(str(d.phone) || str(d.phoneNumber))
      email = cleanContactEmail(str(d.contactEmail) || str(d.email))
    }
  } catch {
    // ignore
  }

  try {
    const user = await getAdminAuth().getUser(clean)
    name = name || str(user.displayName) || null
    phone = phone || cleanContactPhone(user.phoneNumber)
    email = email || cleanContactEmail(user.email)
  } catch {
    // ignore
  }

  if (!name && !phone && !email) return null
  return { name, phone, email }
}

/**
 * Merge Firestore `accommodation_rooms` overlays onto API listings
 * (availability, pricing period, hostel gender, capacity) and resolve host contacts.
 */
export async function enrichStayListings(
  listings: StayListing[],
): Promise<StayListing[]> {
  if (listings.length === 0) return listings

  const byApiId = new Map<number, RoomMeta>()

  try {
    const snap = await getAdminDb().collection(ACCOMMODATION_ROOMS_COLLECTION).get()
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>
      const apiId =
        num(data.apiAccommodationId ?? data.accommodationId ?? data.apiId) ||
        (() => {
          const fromKey = doc.id.match(/_(\d+)$/)
          return fromKey ? Number(fromKey[1]) : 0
        })()
      if (!apiId) continue
      byApiId.set(apiId, metaFromDoc(data))
    }
  } catch (err) {
    console.warn('[stay-rooms] Firestore room enrichment skipped:', err)
  }

  const uids = [
    ...new Set(
      listings
        .map(l => l.hostFirebaseUid)
        .filter((u): u is string => !!u && u.trim().length > 0),
    ),
  ]
  const contacts = new Map<string, Awaited<ReturnType<typeof loadContact>>>()
  await Promise.all(
    uids.map(async uid => {
      contacts.set(uid, await loadContact(uid))
    }),
  )

  return listings.map(listing => {
    let next = applyRoomMeta(listing, byApiId.get(listing.id))
    const contact = listing.hostFirebaseUid
      ? contacts.get(listing.hostFirebaseUid)
      : null
    if (contact) {
      next = {
        ...next,
        hostName: next.hostName || contact.name,
        hostPhone: next.hostPhone || contact.phone,
        hostEmail: next.hostEmail || contact.email,
      }
    }
    return next
  })
}
