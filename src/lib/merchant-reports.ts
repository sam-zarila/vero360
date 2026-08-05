import { formatDateTime } from '@/lib/vero-api'

/** Same collection as Flutter `MerchantProductsPage._reportMerchant`. */
export const MERCHANT_REPORTS_COLLECTION = 'merchant_reports'

export const MERCHANT_REPORT_STATUSES = [
  'open',
  'in_review',
  'resolved',
  'dismissed',
] as const

export type MerchantReportStatus = (typeof MERCHANT_REPORT_STATUSES)[number]

export type MerchantReport = {
  id: string
  merchantId: string
  merchantName: string
  merchantEmail: string | null
  merchantPhone: string | null
  reporterUid: string | null
  reporterEmail: string | null
  reporterPhone: string | null
  message: string
  /** First / primary proof (legacy single field). */
  proofUrl: string | null
  /** All screenshots sent with the report. */
  proofUrls: string[]
  status: MerchantReportStatus | string
  createdAt: string | null
  updatedAt: string | null
  resolvedAt: string | null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
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

export function normalizeMerchantReportStatus(raw: unknown): MerchantReportStatus | string {
  const s = str(raw).toLowerCase()
  if (!s) return 'open'
  if (s === 'reviewing' || s === 'review' || s === 'in_progress' || s === 'inprogress') {
    return 'in_review'
  }
  if (s === 'closed' || s === 'done' || s === 'complete' || s === 'completed') {
    return 'resolved'
  }
  if (s === 'reject' || s === 'rejected' || s === 'ignored') {
    return 'dismissed'
  }
  if ((MERCHANT_REPORT_STATUSES as readonly string[]).includes(s)) return s
  return s
}

export function isMerchantReportStatus(value: string): value is MerchantReportStatus {
  return (MERCHANT_REPORT_STATUSES as readonly string[]).includes(value)
}

/** Collect all proof image URLs from app fields (`proofUrls` + legacy `proofUrl`). */
export function collectProofUrls(data: Record<string, unknown>): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const push = (raw: unknown) => {
    const u = str(raw)
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push(u)
  }

  for (const key of ['proofUrls', 'photoUrls', 'photos', 'images', 'screenshots']) {
    const list = data[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (typeof item === 'string') {
        push(item)
      } else if (item && typeof item === 'object') {
        const m = item as Record<string, unknown>
        push(m.url || m.downloadUrl || m.proofUrl || m.imageUrl)
      }
    }
  }

  push(data.proofUrl)
  push(data.photoUrl)
  push(data.screenshotUrl)

  return out
}

export function parseMerchantReport(
  id: string,
  data: Record<string, unknown>,
): MerchantReport {
  const proofUrls = collectProofUrls(data)
  return {
    id,
    merchantId: str(data.merchantId),
    merchantName: str(data.merchantName) || 'Merchant',
    merchantEmail: null,
    merchantPhone: null,
    reporterUid: str(data.reporterUid) || null,
    reporterEmail: str(data.reporterEmail) || null,
    reporterPhone: null,
    message: str(data.message) || '—',
    proofUrl: proofUrls[0] || null,
    proofUrls,
    status: normalizeMerchantReportStatus(data.status),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    resolvedAt: tsToIso(data.resolvedAt),
  }
}

export function merchantReportStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'open':
      return 'Open'
    case 'in_review':
      return 'In review'
    case 'resolved':
      return 'Resolved'
    case 'dismissed':
      return 'Dismissed'
    default:
      return status || '—'
  }
}

export function merchantReportStatusTone(status: string): {
  bg: string
  color: string
  border: string
} {
  switch (status.toLowerCase()) {
    case 'open':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'in_review':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'resolved':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'dismissed':
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function countMerchantReports(items: MerchantReport[]) {
  return {
    all: items.length,
    open: items.filter(i => i.status === 'open').length,
    in_review: items.filter(i => i.status === 'in_review').length,
    resolved: items.filter(i => i.status === 'resolved').length,
    dismissed: items.filter(i => i.status === 'dismissed').length,
  }
}

/** Primary merchant line: business name, falling back to email or phone. */
export function merchantContactPrimary(item: MerchantReport): string {
  const name = str(item.merchantName)
  if (name && name !== 'Merchant') return name
  return item.merchantEmail || item.merchantPhone || name || 'Merchant'
}

/** Secondary merchant line: email or phone (whichever is not already the primary). */
export function merchantContactSecondary(item: MerchantReport): string | null {
  const primary = merchantContactPrimary(item)
  const email = str(item.merchantEmail)
  const phone = str(item.merchantPhone)
  if (email && email !== primary) return email
  if (phone && phone !== primary) return phone
  if (email && phone && primary === email) return phone
  return null
}

/** Reporter display: email or phone — never UID. */
export function reporterContactLabel(item: MerchantReport): string {
  const email = str(item.reporterEmail)
  if (email) return email
  const phone = str(item.reporterPhone)
  if (phone) return phone
  return '—'
}

/** Public merchant shop path (admin preview under dashboard). Client-safe. */
export function merchantStorePath(merchantId: string): string {
  const id = merchantId.trim()
  if (!id) return '/dashboard/merchant-reports'
  return `/dashboard/merchant/${encodeURIComponent(id)}`
}

export { formatDateTime }
