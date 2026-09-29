import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  cleanContactEmail,
  cleanContactPhone,
} from '@/lib/orders'
import { parseStayBookings, type StayBooking } from '@/lib/stay'
import { USERS_COLLECTION } from '@/lib/users'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

async function loadContact(uid: string) {
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

async function enrichBookingContacts(bookings: StayBooking[]): Promise<StayBooking[]> {
  const uids = new Set<string>()
  for (const b of bookings) {
    if (b.guestFirebaseUid && (!b.guestPhone || !b.guestEmail)) {
      uids.add(b.guestFirebaseUid)
    }
    if (b.hostFirebaseUid && (!b.hostPhone || !b.hostEmail)) {
      uids.add(b.hostFirebaseUid)
    }
  }
  const cache = new Map<string, Awaited<ReturnType<typeof loadContact>>>()
  await Promise.all(
    [...uids].map(async uid => {
      cache.set(uid, await loadContact(uid))
    }),
  )
  return bookings.map(b => {
    let next = b
    if (b.guestFirebaseUid) {
      const c = cache.get(b.guestFirebaseUid)
      if (c) {
        next = {
          ...next,
          guestName: next.guestName || c.name,
          guestPhone: next.guestPhone || c.phone,
          guestEmail: next.guestEmail || c.email,
        }
      }
    }
    if (b.hostFirebaseUid) {
      const c = cache.get(b.hostFirebaseUid)
      if (c) {
        next = {
          ...next,
          hostName: next.hostName || c.name,
          hostPhone: next.hostPhone || c.phone,
          hostEmail: next.hostEmail || c.email,
        }
      }
    }
    return next
  })
}

/**
 * Same Nest booking data the app uses (`/bookings/me`, `/bookings/merchant/me`),
 * via admin list: GET /bookings/admin/all.
 */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const headers: HeadersInit = { Accept: 'application/json' }
    const auth = getVeroAuthHeader(request)
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('bookings', 'admin', 'all'), {
      headers,
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)

    if (!res.ok) {
      return NextResponse.json(
        {
          error: apiErrorMessage(
            body,
            'Failed to load bookings. Redeploy vero-backend with GET /bookings/admin/all (aggregates the same rows as app /bookings/me + /bookings/merchant/me).',
          ),
        },
        { status: res.status },
      )
    }

    let items = parseStayBookings(body).sort((a, b) => {
      const at = a.createdAt
        ? new Date(a.createdAt).getTime()
        : a.bookingDate
          ? new Date(a.bookingDate).getTime()
          : 0
      const bt = b.createdAt
        ? new Date(b.createdAt).getTime()
        : b.bookingDate
          ? new Date(b.bookingDate).getTime()
          : 0
      return bt - at
    })

    try {
      items = await enrichBookingContacts(items)
    } catch (err) {
      console.warn('Stay booking contact enrichment skipped:', err)
    }

    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        paid: items.filter(i => i.paymentStatus === 'PAID').length,
        unpaid: items.filter(i => i.paymentStatus === 'UNPAID').length,
        failed: items.filter(i => i.paymentStatus === 'FAILED').length,
        confirmed: items.filter(i => i.bookingStatus === 'confirmed').length,
        pending: items.filter(i => i.bookingStatus === 'pending').length,
      },
    })
  } catch (err) {
    console.error('Admin stay bookings GET error:', err)
    return NextResponse.json({ error: 'Could not reach bookings API' }, { status: 502 })
  }
}
