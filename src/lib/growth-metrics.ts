import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'
import { fetchWebsiteOverview, fetchTrafficBreakdown } from '@/lib/google-analytics'
import { fetchAppPerformanceOverview } from '@/lib/app-performance'
import { USERS_COLLECTION } from '@/lib/users'
import { JWT } from 'google-auth-library'

function asMillis(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'string') {
    const t = new Date(value).getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().getTime()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return seconds * 1000
  }
  return null
}

export type ActiveUserCounts = {
  dau: number
  wau: number
  mau: number
  sampleSize: number
}

/** Count users with lastActiveAt in the last 1 / 7 / 30 days. */
export async function countActiveUsersFromPresence(): Promise<ActiveUserCounts> {
  const now = Date.now()
  const day = now - 1 * 86400000
  const week = now - 7 * 86400000
  const month = now - 30 * 86400000
  const snap = await getAdminDb()
    .collection(USERS_COLLECTION)
    .select('lastActiveAt', 'lastSeen')
    .get()

  let dau = 0
  let wau = 0
  let mau = 0
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>
    const t = asMillis(data.lastActiveAt) ?? asMillis(data.lastSeen)
    if (t == null) continue
    if (t >= month) mau += 1
    if (t >= week) wau += 1
    if (t >= day) dau += 1
  }
  return { dau, wau, mau, sampleSize: snap.size }
}

async function fetchPlayInstallsApprox(days: number): Promise<number | null> {
  const packageName =
    process.env.PLAY_PACKAGE_NAME?.trim() || 'com.vero265.app'
  const saEmail =
    process.env.FIREBASE_CLIENT_EMAIL?.trim() ||
    process.env.GA_CLIENT_EMAIL?.trim() ||
    ''
  const keyRaw =
    process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim()
      ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
      : process.env.FIREBASE_PRIVATE_KEY || process.env.GA_PRIVATE_KEY || ''
  if (!saEmail || !keyRaw) return null

  // Best-effort: Play Developer Reporting API (may lack grant — callers tolerate null).
  try {
    const privateKey = keyRaw
      .replace(/\r/g, '')
      .replace(/\\\\n/g, '\n')
      .replace(/\\n/g, '\n')
    const client = new JWT({
      email: saEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
    })
    const token = await client.getAccessToken()
    if (!token.token) return null

    const end = new Date()
    const start = new Date(Date.now() - days * 86400000)
    const body = {
      metrics: ['STORE_LISTING_ACQUISITIONS'],
      timelineSpec: {
        aggregationPeriod: 'DAY',
        startTime: {
          year: start.getUTCFullYear(),
          month: start.getUTCMonth() + 1,
          day: start.getUTCDate(),
        },
        endTime: {
          year: end.getUTCFullYear(),
          month: end.getUTCMonth() + 1,
          day: end.getUTCDate(),
        },
      },
    }
    const res = await fetch(
      `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${packageName}/acquisitionMetricSet:query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as {
      rows?: Array<{ metrics?: Array<{ decimalValue?: { value?: string } }> }>
    } | null
    if (!data?.rows?.length) return null
    let total = 0
    for (const row of data.rows) {
      const raw = row.metrics?.[0]?.decimalValue?.value
      const n = Number(raw)
      if (Number.isFinite(n)) total += n
    }
    return Math.round(total)
  } catch {
    return null
  }
}

export type GrowthOverview = {
  days: number
  mau: number
  wau: number
  dau: number
  newSignups7d: number
  newSignupsMonth: number
  websiteSessions: number
  websiteActiveUsers: number
  websiteNewUsers: number
  installs: number | null
  installsSource: 'play' | 'unavailable'
  channels: Array<{ label: string; sessions: number; users: number }>
  campaigns: Array<{ label: string; sessions: number; users: number }>
  users: {
    total: number
    customers: number
    merchants: number
    drivers: number
    newLast7Days: number
    newThisMonth: number
  }
  fetchedAt: string
  notes: string[]
}

export async function buildGrowthOverview(opts?: {
  days?: number
  request?: Request
}): Promise<GrowthOverview> {
  const days = Math.min(90, Math.max(1, opts?.days ?? 28))
  const notes: string[] = []

  const [presence, appPerf, website, traffic, playInstalls] = await Promise.all([
    countActiveUsersFromPresence().catch(err => {
      notes.push('MAU from presence unavailable')
      console.warn(err)
      return { dau: 0, wau: 0, mau: 0, sampleSize: 0 }
    }),
    fetchAppPerformanceOverview({
      request: opts?.request,
      includePlatformBalance: false,
    }).catch(err => {
      notes.push('App signup snapshot unavailable')
      console.warn(err)
      return null
    }),
    fetchWebsiteOverview({ days }).catch(err => {
      notes.push('Website GA4 unavailable')
      console.warn(err)
      return null
    }),
    fetchTrafficBreakdown({ days }).catch(err => {
      notes.push('Traffic breakdown unavailable')
      console.warn(err)
      return { channels: [], sources: [], campaigns: [] }
    }),
    fetchPlayInstallsApprox(days),
  ])

  const sessionsMetric = website?.metrics.find(m => m.key === 'sessions')
  const activeMetric = website?.metrics.find(m => m.key === 'activeUsers')
  const newMetric = website?.metrics.find(m => m.key === 'newUsers')

  if (playInstalls == null) {
    notes.push(
      'Play install stats need Play Console API access for the service account; showing unavailable until linked.',
    )
  }

  return {
    days,
    mau: presence.mau,
    wau: presence.wau,
    dau: presence.dau,
    newSignups7d: appPerf?.users.newLast7Days ?? 0,
    newSignupsMonth: appPerf?.users.newThisMonth ?? 0,
    websiteSessions: sessionsMetric?.raw ?? 0,
    websiteActiveUsers: activeMetric?.raw ?? 0,
    websiteNewUsers: newMetric?.raw ?? 0,
    installs: playInstalls,
    installsSource: playInstalls == null ? 'unavailable' : 'play',
    channels: traffic.channels,
    campaigns: traffic.campaigns,
    users: {
      total: appPerf?.users.total ?? 0,
      customers: appPerf?.users.customers ?? 0,
      merchants: appPerf?.users.merchants ?? 0,
      drivers: appPerf?.users.drivers ?? 0,
      newLast7Days: appPerf?.users.newLast7Days ?? 0,
      newThisMonth: appPerf?.users.newThisMonth ?? 0,
    },
    fetchedAt: new Date().toISOString(),
    notes,
  }
}
