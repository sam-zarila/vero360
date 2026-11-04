import 'server-only'

import { JWT } from 'google-auth-library'

/** Measurement ID already wired in `src/app/layout.tsx`. */
export const GA_MEASUREMENT_ID =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()) ||
  'G-G9KMEJ6XQZ'

/**
 * Numeric GA4 property id from Analytics Admin → Property settings.
 * Matches https://analytics.google.com/…/a273004667p509919249/…
 */
export const GA_PROPERTY_ID =
  (typeof process !== 'undefined' && process.env.GA_PROPERTY_ID?.trim()) || '509919249'

export const GA_ACCOUNT_ID =
  (typeof process !== 'undefined' && process.env.GA_ACCOUNT_ID?.trim()) || '273004667'

export const GA_CONSOLE_URL =
  (typeof process !== 'undefined' && process.env.GA_CONSOLE_URL?.trim()) ||
  `https://analytics.google.com/analytics/web/#/a${GA_ACCOUNT_ID}p${GA_PROPERTY_ID}/reports/intelligenthome`

export type GaOverviewMetric = {
  key: string
  label: string
  value: string
  raw: number
}

export type GaTopRow = {
  label: string
  value: string
  raw: number
}

export type GaWebsiteOverview = {
  propertyId: string
  measurementId: string
  consoleUrl: string
  rangeLabel: string
  metrics: GaOverviewMetric[]
  topPages: GaTopRow[]
  topCountries: GaTopRow[]
  fetchedAt: string
}

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function normalizePrivateKey(key: string): string {
  let k = key.trim()
  while (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r/g, '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
}

function resolveServiceAccount(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = pickEnv('FIREBASE_CLIENT_EMAIL', 'GA_CLIENT_EMAIL')
  const privateKeyB64 = pickEnv('FIREBASE_PRIVATE_KEY_BASE64')
  const privateKeyRaw = privateKeyB64
    ? Buffer.from(privateKeyB64, 'base64').toString('utf8')
    : pickEnv('FIREBASE_PRIVATE_KEY', 'GA_PRIVATE_KEY')
  if (!clientEmail || !privateKeyRaw) return null
  return { clientEmail, privateKey: normalizePrivateKey(privateKeyRaw) }
}

async function getAccessToken(): Promise<string> {
  const sa = resolveServiceAccount()
  if (!sa) {
    throw new Error(
      'Missing service account. Set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (or GA_CLIENT_EMAIL + GA_PRIVATE_KEY), then add that email as a Viewer on the GA4 property.',
    )
  }

  const client = new JWT({
    email: sa.clientEmail,
    key: sa.privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('Could not obtain Google Analytics access token')
  return token.token
}

type RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>
    metricValues?: Array<{ value?: string }>
  }>
  metricHeaders?: Array<{ name?: string }>
  error?: { message?: string }
}

async function runReport(
  token: string,
  body: Record<string, unknown>,
): Promise<RunReportResponse> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  )
  const data = (await res.json().catch(() => ({}))) as RunReportResponse
  if (!res.ok) {
    const msg =
      data.error?.message ||
      (typeof (data as { message?: string }).message === 'string'
        ? (data as { message?: string }).message
        : null) ||
      `Google Analytics API error (${res.status})`
    throw new Error(msg)
  }
  return data
}

function metricNumber(rows: RunReportResponse['rows'], index = 0): number {
  const raw = rows?.[0]?.metricValues?.[index]?.value
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return n.toLocaleString('en-US')
  return String(Math.round(n))
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m <= 0) return `${rem}s`
  return `${m}m ${rem.toString().padStart(2, '0')}s`
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function mapTopRows(
  report: RunReportResponse,
  limit = 5,
): GaTopRow[] {
  return (report.rows || []).slice(0, limit).map(row => {
    const label = String(row.dimensionValues?.[0]?.value || '(not set)')
    const raw = Number(row.metricValues?.[0]?.value || 0)
    return {
      label: label === '/' ? 'Home' : label,
      value: formatCount(raw),
      raw: Number.isFinite(raw) ? raw : 0,
    }
  })
}

export async function fetchWebsiteOverview(opts?: {
  days?: number
}): Promise<GaWebsiteOverview> {
  const days = Math.min(90, Math.max(1, opts?.days ?? 28))
  const startDate = `${days}daysAgo`
  const token = await getAccessToken()

  const [summary, pages, countries] = await Promise.all([
    runReport(token, {
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
      ],
    }),
    runReport(token, {
      dateRanges: [{ startDate, endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 8,
    }),
    runReport(token, {
      dateRanges: [{ startDate, endDate: 'today' }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    }),
  ])

  const activeUsers = metricNumber(summary.rows, 0)
  const sessions = metricNumber(summary.rows, 1)
  const pageViews = metricNumber(summary.rows, 2)
  const bounceRate = metricNumber(summary.rows, 3)
  const avgDuration = metricNumber(summary.rows, 4)
  const newUsers = metricNumber(summary.rows, 5)

  return {
    propertyId: GA_PROPERTY_ID,
    measurementId: GA_MEASUREMENT_ID,
    consoleUrl: GA_CONSOLE_URL,
    rangeLabel: `Last ${days} days`,
    metrics: [
      { key: 'activeUsers', label: 'Active users', value: formatCount(activeUsers), raw: activeUsers },
      { key: 'newUsers', label: 'New users', value: formatCount(newUsers), raw: newUsers },
      { key: 'sessions', label: 'Sessions', value: formatCount(sessions), raw: sessions },
      { key: 'pageViews', label: 'Page views', value: formatCount(pageViews), raw: pageViews },
      {
        key: 'bounceRate',
        label: 'Bounce rate',
        value: formatPercent(bounceRate),
        raw: bounceRate,
      },
      {
        key: 'avgDuration',
        label: 'Avg. session',
        value: formatDuration(avgDuration),
        raw: avgDuration,
      },
    ],
    topPages: mapTopRows(pages),
    topCountries: mapTopRows(countries),
    fetchedAt: new Date().toISOString(),
  }
}
