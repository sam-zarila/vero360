import 'server-only'

import { formatMwk } from '@/lib/vero-api'
import { getAdminDb } from '@/lib/firebase-admin'
import { resolveStorageDownloadUrl } from '@/lib/firebase-storage-url'
import {
  MARKETPLACE_ITEMS_COLLECTION,
  parseFirestoreMarketplaceListing,
  resolveMarketplaceImage,
  type MarketplaceListing,
} from '@/lib/marketplace'

export type MerchantStoreProfile = {
  id: string
  name: string
  email: string | null
  phone: string | null
  description: string | null
  profileUrl: string | null
  openingHours: string | null
}

export type MerchantStoreView = {
  profile: MerchantStoreProfile
  products: MarketplaceListing[]
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function cleanEmail(raw: string): string {
  const e = raw.trim()
  if (!e) return ''
  const lower = e.toLowerCase()
  if (lower.endsWith('@phone.vero360.app') || lower.endsWith('@firebase.vero.local')) {
    return ''
  }
  return e
}

function nameFromMap(data: Record<string, unknown>): string {
  for (const key of [
    'businessName',
    'merchantName',
    'displayName',
    'fullName',
    'name',
  ]) {
    const v = str(data[key])
    if (v) return v
  }
  return ''
}

async function loadProfileDocs(merchantId: string) {
  const db = getAdminDb()
  const [merchantSnap, userSnap, accomSnap] = await Promise.all([
    db.collection('marketplace_merchants').doc(merchantId).get(),
    db.collection('users').doc(merchantId).get(),
    db.collection('accommodation_merchants').doc(merchantId).get(),
  ])
  return { merchantSnap, userSnap, accomSnap }
}

export async function loadMerchantStore(merchantId: string): Promise<MerchantStoreView | null> {
  const id = merchantId.trim()
  if (!id) return null

  const db = getAdminDb()
  const { merchantSnap, userSnap, accomSnap } = await loadProfileDocs(id)

  let name = ''
  let email = ''
  let phone = ''
  let description = ''
  let profileUrl = ''
  let openingHours = ''

  const apply = (data: Record<string, unknown>) => {
    if (!name) name = nameFromMap(data)
    if (!email) {
      email =
        cleanEmail(str(data.email)) ||
        cleanEmail(str(data.userEmail)) ||
        cleanEmail(str(data.contactEmail))
    }
    if (!phone) phone = str(data.phone) || str(data.phoneNumber) || str(data.mobile)
    if (!description) {
      description = str(data.businessDescription) || str(data.description) || str(data.about)
    }
    if (!profileUrl) {
      profileUrl = str(data.profilePicture) || str(data.profilepicture) || str(data.photoUrl)
    }
    if (!openingHours) openingHours = str(data.openingHours)
  }

  if (merchantSnap.exists) apply(merchantSnap.data() as Record<string, unknown>)
  if (accomSnap.exists) apply(accomSnap.data() as Record<string, unknown>)
  if (userSnap.exists) apply(userSnap.data() as Record<string, unknown>)

  let snap
  try {
    snap = await db
      .collection(MARKETPLACE_ITEMS_COLLECTION)
      .where('merchantId', '==', id)
      .get()
  } catch {
    snap = null
  }

  let products: MarketplaceListing[] = snap
    ? snap.docs
        .map(doc =>
          parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>),
        )
        .filter((item): item is MarketplaceListing => item != null)
    : []

  if (products.length === 0 && name) {
    try {
      const byName = await db
        .collection(MARKETPLACE_ITEMS_COLLECTION)
        .where('merchantName', '==', name)
        .get()
      products = byName.docs
        .map(doc => parseFirestoreMarketplaceListing(doc.id, doc.data() as Record<string, unknown>))
        .filter((item): item is MarketplaceListing => item != null)
    } catch {
      // index may be missing
    }
  }

  products.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at
  })

  if (!name && products[0]?.merchantName) {
    name = products[0].merchantName
  }

  const resolvedProfile = profileUrl
    ? (await resolveStorageDownloadUrl(profileUrl)) || resolveMarketplaceImage(profileUrl)
    : null

  if (!name && !email && !phone && products.length === 0) {
    return null
  }

  return {
    profile: {
      id,
      name: name || 'Merchant',
      email: email || null,
      phone: phone || null,
      description: description || null,
      profileUrl: resolvedProfile,
      openingHours: openingHours || null,
    },
    products,
  }
}

export { formatMwk }
