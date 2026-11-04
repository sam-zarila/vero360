import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'
import {
  buildDigitalOrderCounts,
  listDigitalServiceOrders,
} from '@/lib/digital-services-admin'
import { parseFoodAdminOrder } from '@/lib/food-orders-admin'
import { nestAdminFetch } from '@/lib/nest-admin'
import { parseCourierDeliveries } from '@/lib/courier'
import { parseMarketplaceOrders } from '@/lib/orders'
import { parseAdminRidesResponse } from '@/lib/rides'
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
  newLast28Days: number
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
  if (!value) return null
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

async function loadUsers(): Promise<AppUserBreakdown> {
  const snap = await getAdminDb().collection(USERS_COLLECTION).select('role', 'createdAt').get()
  const now = Date.now()
  const week = now - 7 * 86400000
  const month = now - 28 * 86400000
  const users: AppUserBreakdown = {
    total: 0,
    customers: 0,
    merchants: 0,
    drivers: 0,
    other: 0,
    newLast7Days: 0,
    newLast28Days: 0,
  }

  for (const doc of snap.docs) {
    users.total += 1
    const data = doc.data() as Record<string, unknown>
    const role = normalizeRole(data.role)
    if (role === 'customer') users.customers += 1
    else if (role === 'merchant') users.merchants += 1
    else if (role === 'driver') users.drivers += 1
    else users.other += 1

    const created = asIso(data.createdAt)
    if (created) {
      const t = new Date(created).getTime()
      if (t >= week) users.newLast7Days += 1
      if (t >= month) users.newLast28Days += 1
    }
  }
  return users
}

async function loadRides(request?: Request): Promise<ServicePerformance> {
  try {
    const { res, body, error } = await nestAdminFetch(
      ['admin', 'rides?take=300'],
      undefined,
      request,
    )
    if (!res.ok) throw new Error(error || 'Rides unavailable')
    const parsed = parseAdminRidesResponse(body)
    const completed = parsed.counts.completed
    const pending = parsed.counts.active + parsed.counts.requested + parsed.counts.inProgress
    const moneyMwk = parsed.rides.reduce((sum, ride) => {
      const fare = ride.actualFare ?? ride.estimatedFare
      return sum + (ride.status === 'COMPLETED' ? money(fare) : 0)
    }, 0)
    const activity = parsed.counts.all || parsed.total || parsed.rides.length
    return {
      id: 'vero-ride',
      name: 'Vero Ride',
      plain: 'People booking cars and getting rides.',
      activity,
      completed,
      pending,
      moneyMwk,
      health: healthFromActivity(activity, completed),
      detail: `${fmt(completed)} completed rides · ${fmt(pending)} still active`,
    }
  } catch {
    return {
      id: 'vero-ride',
      name: 'Vero Ride',
      plain: 'People booking cars and getting rides.',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Ride numbers could not be loaded right now.',
    }
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
      plain: 'Parcels and same-day deliveries in Lilongwe.',
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
      plain: 'Parcels and same-day deliveries in Lilongwe.',
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
      plain: 'Restaurant and meal orders from the app.',
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
      plain: 'Restaurant and meal orders from the app.',
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
      plain: 'People buying and selling products.',
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
      plain: 'People buying and selling products.',
      activity: 0,
      completed: 0,
      pending: 0,
      moneyMwk: 0,
      health: 'quiet',
      detail: 'Marketplace numbers could not be loaded right now.',
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
      plain: 'Subscriptions, gift cards, and digital top-ups.',
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
      plain: 'Subscriptions, gift cards, and digital top-ups.',
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
  const [users, ride, courier, food, marketplace, digital, platformBalanceMwk] =
    await Promise.all([
      loadUsers(),
      loadRides(opts?.request),
      loadCourier(),
      loadFood(),
      loadMarketplace(),
      loadDigital(),
      loadPlatformBalance(Boolean(opts?.includePlatformBalance)),
    ])

  const services = [ride, courier, food, marketplace, digital].sort((a, b) => {
    if (b.activity !== a.activity) return b.activity - a.activity
    return b.moneyMwk - a.moneyMwk
  })

  const top = services[0]
  const quiet = services.filter(s => s.health === 'quiet').map(s => s.name)

  const rankingNote = top && top.activity > 0
    ? `${top.name} is currently the busiest service (${fmt(top.activity)} recent activities).`
    : 'Service activity is still low across the board — a good time to push installs and campaigns.'

  const activityNote = `The app has ${fmt(users.total)} accounts: ${fmt(users.customers)} customers, ${fmt(users.merchants)} merchants, and ${fmt(users.drivers)} drivers. ${fmt(users.newLast7Days)} joined in the last 7 days.`

  const moneyTotal = services.reduce((s, x) => s + x.moneyMwk, 0)
  const financeNote =
    moneyTotal > 0
      ? `Across tracked paid activity we can see about MWK ${fmt(moneyTotal)} moving through rides, food, marketplace, and digital services (sample of recent records).`
      : 'Paid activity totals will show here as more completed orders come through.'

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
