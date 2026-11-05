import 'server-only'

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  buildDigitalOrderCounts,
  listDigitalServiceOrders,
} from '@/lib/digital-services-admin'
import { parseFoodAdminOrder } from '@/lib/food-orders-admin'
import { nestAdminFetch } from '@/lib/nest-admin'
import { parseCourierDeliveries } from '@/lib/courier'
import { parseMarketplaceOrders } from '@/lib/orders'
import { parseAdminRidesResponse, type AdminRide } from '@/lib/rides'
import { guestOrderToStayBooking, listGuestOrders } from '@/lib/guest-checkout'
import { parseStayBookings } from '@/lib/stay'
import { normalizeRole, USERS_COLLECTION } from '@/lib/users'
import {
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  parseWallet,
} from '@/lib/finance'
import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

export type AppUserBreakdown = {
  total: number
  customers: number
  merchants: number
  drivers: number
  other: number
  newLast7Days: number
  newLast30Days: number
}

export type ServicePerformance = {
  id: string
  name: string
  plain: string
  activity: number
  completed: number
  pending: number
  moneyMwk: number
  health: 'strong' | 'steady' | 'quiet'
  detail: string
}

export type AppPerformanceOverview = {
  users: AppUserBreakdown
  services: ServicePerformance[]
  rankingNote: string
  activityNote: string
  financeNote: string
  platformBalanceMwk: number | null
  fetchedAt: string
}

function asIso(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    if (!Number.isFinite(ms)) return null
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

function money(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function healthFromActivity(activity: number, completed: number): ServicePerformance['health'] {
  if (activity >= 40 || completed >= 25) return 'strong'
  if (activity >= 8 || completed >= 4) return 'steady'
  return 'quiet'
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-MW')
}

function signupMillis(value: unknown): number | null {
  const iso = asIso(value)
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/** Firebase Auth creation time is the account join date. Firestore createdAt is only a fallback. */
async function loadAuthJoinedAt(): Promise<Map<string, number>> {
  const auth = getAdminAuth()
  const joined = new Map<string, number>()
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      const t = signupMillis(user.metadata.creationTime)
      if (t != null) joined.set(user.uid, t)
    }
    pageToken = page.pageToken
  } while (pageToken)
  return joined
}

async function loadUsers(): Promise<AppUserBreakdown> {
  const snap = await getAdminDb()
    .collection(USERS_COLLECTION)
    .select('role', 'createdAt', 'registeredAt', 'joinedAt')
    .get()
  let authJoined = new Map<string, number>()
  try {
    authJoined = await loadAuthJoinedAt()
  } catch (err) {
    console.warn('Auth join dates unavailable, using Firestore dates:', err)
  }
  const now = Date.now()
  const week = now - 7 * 86400000
  const month = now - 30 * 86400000
  const users: AppUserBreakdown = {
    total: 0,
    customers: 0,
    merchants: 0,
    drivers: 0,
    other: 0,
    newLast7Days: 0,
    newLast30Days: 0,
  }

  for (const doc of snap.docs) {
    users.total += 1
    const data = doc.data() as Record<string, unknown>
    const role = normalizeRole(data.role)
    if (role === 'customer') users.customers += 1
    else if (role === 'merchant') users.merchants += 1
    else if (role === 'driver') users.drivers += 1
    else users.other += 1

    const joined =
      authJoined.get(doc.id) ??
      signupMillis(data.createdAt) ??
      signupMillis(data.registeredAt) ??
      signupMillis(data.joinedAt)
    if (joined != null && joined <= now + 60_000) {
      if (joined >= week) users.newLast7Days += 1
      if (joined >= month) users.newLast30Days += 1
    }
  }
  return users
}

const ACTIVE_RIDE = new Set(['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS'])

function isBikeRide(ride: AdminRide): boolean {
  return ride.preferredVehicleClass.toUpperCase() === 'BIKE'
}

function ridesToService(
  id: string,
  name: string,
  rides: AdminRide[],
): ServicePerformance {
  const completed = rides.filter(ride => ride.status === 'COMPLETED')
  const pending = rides.filter(ride => ACTIVE_RIDE.has(ride.status)).length
  const moneyMwk = completed.reduce((sum, ride) => {
    const fare = ride.actualFare ?? ride.estimatedFare
    return sum + money(fare)
  }, 0)
  return {
    id,
    name,
    plain: name === 'Vero Bike' ? 'Bike rides' : 'Car rides',
    activity: rides.length,
    completed: completed.length,
    pending,
    moneyMwk,
    health: healthFromActivity(rides.length, completed.length),
    detail: `${fmt(completed.length)} completed · ${fmt(pending)} active`,
  }
}

function emptyRideService(id: string, name: string): ServicePerformance {
  return {
    id,
    name,
    plain: name === 'Vero Bike' ? 'Bike rides' : 'Car rides',
    activity: 0,
    completed: 0,
    pending: 0,
    moneyMwk: 0,
    health: 'quiet',
    detail: 'Ride numbers could not be loaded right now.',
  }
}

async function loadRideServices(
  request?: Request,
): Promise<[ServicePerformance, ServicePerformance]> {
  try {
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'rides?take=500'],
      undefined,
      request,
    )
    if (!res.ok) throw new Error(error || 'Rides unavailable')
    const parsed = parseAdminRidesResponse(body)
    const bikes = parsed.rides.filter(isBikeRide)
    const cars = parsed.rides.filter(ride => !isBikeRide(ride))
    return [
      ridesToService('vero-ride', 'Vero Ride', cars),
      ridesToService('vero-bike', 'Vero Bike', bikes),
    ]
  } catch {
    return [
      emptyRideService('vero-ride', 'Vero Ride'),
      emptyRideService('vero-bike', 'Vero Bike'),
    ]
  }
}

async function loadCourier(): Promise<ServicePerformance> {
  try {
    const res = await fetch(veroEndpoint('verocourier', 'all', 'deliveries'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) throw new Error(apiErrorMessage(body, 'Courier unavailable'))
    const items = parseCourierDeliveries(body)
    const completed = items.filter(i => i.status === 'DELIVERED').length
    const pending = items.filter(
      i => i.status === 'PENDING' || i.status === 'ACCEPTED' || i.status === 'ON_THE_WAY',
    ).length
    return {
      id: 'courier',
      name: 'Vero Courier',
      plain: 'Courier deliveries',
      activity: items.length,
      completed,
      pending,
      moneyMwk: 0,
      health: healthFromActivity(items.length, completed),
      detail: `${fmt(completed)} delivered · ${fmt(pending)} in progress`,
    }
  } catch {
    return {
      id: 'courier',
      name: 'Vero Courier',
      plain: 'Courier deliveries',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Courier numbers could not be loaded right now.',
    }
  }
}

async function loadFood(): Promise<ServicePerformance> {
  try {
    const db = getAdminDb()
    let snap
    try {
      snap = await db.collection('food_orders').orderBy('createdAt', 'desc').limit(400).get()
    } catch {
      snap = await db.collection('food_orders').limit(400).get()
    }
    const items = snap.docs.map(d =>
      parseFoodAdminOrder(d.id, d.data() as Record<string, unknown>),
    )
    const completed = items.filter(i => i.status === 'delivered').length
    const pending = items.filter(
      i => i.status === 'pending' || i.status === 'preparing' || i.status === 'sent' || i.status === 'ready',
    ).length
    const moneyMwk = items
      .filter(i => i.status !== 'cancelled' && String(i.paymentStatus).toLowerCase() === 'paid')
      .reduce((s, i) => s + money(i.totalMwk), 0)
    return {
      id: 'food',
      name: 'Food',
      plain: 'Food orders',
      activity: items.length,
      completed,
      pending,
      moneyMwk,
      health: healthFromActivity(items.length, completed),
      detail: `${fmt(completed)} delivered · ${fmt(pending)} being prepared or sent`,
    }
  } catch {
    return {
      id: 'food',
      name: 'Food',
      plain: 'Food orders',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Food order numbers could not be loaded right now.',
    }
  }
}

async function loadMarketplace(): Promise<ServicePerformance> {
  try {
    const res = await fetch(veroEndpoint('orders', 'admin', 'all'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    const items = res.ok ? parseMarketplaceOrders(body) : []
    const completed = items.filter(i => {
      const s = String(i.status || '').toUpperCase()
      return s.includes('DELIVER') || s.includes('COMPLETE') || s === 'PAID'
    }).length
    const pending = items.filter(i => {
      const s = String(i.status || '').toUpperCase()
      return s.includes('PEND') || s.includes('PROCESS') || s.includes('CONFIRM')
    }).length
    const moneyMwk = items
      .filter(i => String(i.paymentStatus || '').toUpperCase() === 'PAID')
      .reduce((s, i) => s + money(i.total), 0)
    return {
      id: 'marketplace',
      name: 'Marketplace',
      plain: 'Marketplace orders',
      activity: items.length,
      completed,
      pending,
      moneyMwk,
      health: healthFromActivity(items.length, completed),
      detail: `${fmt(items.length)} orders seen · ${fmt(pending)} still open`,
    }
  } catch {
    return {
      id: 'marketplace',
      name: 'Marketplace',
      plain: 'Marketplace orders',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Marketplace numbers could not be loaded right now.',
    }
  }
}

async function loadStays(): Promise<ServicePerformance> {
  try {
    const res = await fetch(veroEndpoint('bookings', 'admin', 'all'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    let items = res.ok ? parseStayBookings(body) : []
    try {
      const guests = (await listGuestOrders('stay')).map(guestOrderToStayBooking)
      const seen = new Set(items.map(item => item.bookingNumber))
      items = [...items, ...guests.filter(item => !seen.has(item.bookingNumber))]
    } catch {
      // Guest stay rows are optional.
    }
    if (!res.ok && items.length === 0) {
      throw new Error(apiErrorMessage(body, 'Stays unavailable'))
    }
    const completed = items.filter(item => {
      const status = item.bookingStatus.toLowerCase()
      return status === 'completed' || status === 'confirmed'
    }).length
    const pending = items.filter(item => item.bookingStatus.toLowerCase() === 'pending').length
    const moneyMwk = items
      .filter(item => item.paid || item.paymentStatus.toUpperCase() === 'PAID')
      .reduce((sum, item) => sum + money(item.price), 0)
    return {
      id: 'stays',
      name: 'Stays',
      plain: 'Accommodation bookings',
      activity: items.length,
      completed,
      pending,
      moneyMwk,
      health: healthFromActivity(items.length, completed),
      detail: `${fmt(completed)} confirmed or completed · ${fmt(pending)} pending`,
    }
  } catch {
    return {
      id: 'stays',
      name: 'Stays',
      plain: 'Accommodation bookings',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Stay numbers could not be loaded right now.',
    }
  }
}

async function loadDigital(): Promise<ServicePerformance> {
  try {
    const items = await listDigitalServiceOrders({ limit: 500 })
    const counts = buildDigitalOrderCounts(items)
    return {
      id: 'digital-services',
      name: 'Digital Services',
      plain: 'Subscriptions, gift cards, and top-ups',
      activity: counts.all,
      completed: counts.paid,
      pending: counts.pending,
      moneyMwk: counts.revenuePaid,
      health: healthFromActivity(counts.all, counts.paid),
      detail: `${fmt(counts.paid)} paid · ${fmt(counts.pending)} waiting · MWK ${fmt(counts.revenuePaid)} paid so far`,
    }
  } catch {
    return {
      id: 'digital-services',
      name: 'Digital Services',
      plain: 'Subscriptions, gift cards, and top-ups',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Digital service numbers could not be loaded right now.',
    }
  }
}

async function loadPlatformBalance(include: boolean): Promise<number | null> {
  if (!include) return null
  try {
    const snap = await getAdminDb().collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_USER_ID).get()
    if (!snap.exists) return 0
    return parseWallet(snap.id, snap.data() as Record<string, unknown>).balance
  } catch {
    return null
  }
}

export async function fetchAppPerformanceOverview(opts?: {
  request?: Request
  includePlatformBalance?: boolean
}): Promise<AppPerformanceOverview> {
  const [users, ridePair, courier, food, marketplace, stays, digital, platformBalanceMwk] =
    await Promise.all([
      loadUsers(),
      loadRideServices(opts?.request),
      loadCourier(),
      loadFood(),
      loadMarketplace(),
      loadStays(),
      loadDigital(),
      loadPlatformBalance(Boolean(opts?.includePlatformBalance)),
    ])
  const [ride, bike] = ridePair

  const services = [ride, bike, courier, food, marketplace, stays, digital].sort((a, b) => {
    if (b.activity !== a.activity) return b.activity - a.activity
    return b.moneyMwk - a.moneyMwk
  })

  const top = services[0]
  const quiet = services.filter(s => s.health === 'quiet').map(s => s.name)

  const rankingNote = top && top.activity > 0
    ? `${top.name} leads recent activity (${fmt(top.activity)}).`
    : 'No recent service activity.'

  const activityNote = `${fmt(users.total)} accounts — ${fmt(users.customers)} customers, ${fmt(users.merchants)} merchants, ${fmt(users.drivers)} drivers. ${fmt(users.newLast7Days)} new in the last 7 days, ${fmt(users.newLast30Days)} in the last 30 days.`

  const moneyTotal = services.reduce((s, x) => s + x.moneyMwk, 0)
  const financeNote =
    moneyTotal > 0
      ? `Paid volume: MWK ${fmt(moneyTotal)} across tracked services.`
      : 'No paid volume in the current sample.'

  if (quiet.length) {
    // keep rankingNote focused; quiet services mentioned in UI
  }

  return {
    users,
    services,
    rankingNote,
    activityNote,
    financeNote,
    platformBalanceMwk,
    fetchedAt: new Date().toISOString(),
  }
}
