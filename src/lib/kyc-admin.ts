import { parseAppUser } from '@/lib/users'

export type KycBucket =
  | 'approved'
  | 'in_review'
  | 'not_started'
  | 'in_progress'
  | 'declined'
  | 'expired'
  | 'abandoned'
  | 'resubmitted'

export type KycWarning = {
  title: string
  detail: string
}

export type KycCheck = {
  id: string
  label: string
  status: string
  passed: boolean | null
  score: string
  warnings: KycWarning[]
  fields: Array<{ label: string; value: string }>
}

export type KycVerification = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  bucket: KycBucket
  label: string
  sessionId: string
  rejectionReason: string
  updatedAt: string | null
  documentLabel: string
  documentType: string
  issuingState: string
  portraitUrl: string
  checks: KycCheck[]
  warnings: KycWarning[]
}

export type KycCounts = {
  all: number
  approved: number
  inReview: number
  notStarted: number
  inProgress: number
  declined: number
  expired: number
  other: number
}

export type KycVolume = {
  last30: number
  previous30: number
  changePercent: number | null
}

const BUCKET_LABEL: Record<KycBucket, string> = {
  approved: 'APPROVED',
  in_review: 'IN REVIEW',
  not_started: 'NOT STARTED',
  in_progress: 'IN PROGRESS',
  declined: 'DECLINED',
  expired: 'EXPIRED',
  abandoned: 'ABANDONED',
  resubmitted: 'RESUBMITTED',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
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

export function kycBucket(status: string): KycBucket {
  switch (status.trim().toLowerCase()) {
    case 'verified':
    case 'approved':
      return 'approved'
    case 'pending_review':
    case 'in_review':
    case 'in review':
      return 'in_review'
    case 'pending':
    case 'not_started':
    case 'not started':
      return 'not_started'
    case 'rejected':
    case 'declined':
      return 'declined'
    case 'expired':
    case 'kyc_expired':
      return 'expired'
    case 'abandoned':
      return 'abandoned'
    case 'resubmitted':
      return 'resubmitted'
    case 'in_progress':
    case 'in progress':
      return 'in_progress'
    default:
      return 'in_progress'
  }
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function firstIdVerification(decision: unknown): Record<string, unknown> | null {
  const record = asRecord(decision)
  if (!record) return null
  for (const key of ['id_verification', 'id_verifications', 'idVerification']) {
    const value = record[key]
    if (Array.isArray(value)) {
      const first = asRecord(value[0])
      if (first) return first
    }
    const one = asRecord(value)
    if (one) return one
  }
  return null
}

const CHECK_DEFS: Array<{ keys: string[]; id: string; label: string }> = [
  { keys: ['id_verification', 'id_verifications', 'idVerification'], id: 'id', label: 'ID Verification' },
  { keys: ['liveness'], id: 'liveness', label: 'Liveness' },
  { keys: ['face_match', 'face_matches', 'faceMatch'], id: 'face', label: 'Face Match' },
  { keys: ['ip_analysis', 'ipAnalysis'], id: 'ip', label: 'Device & IP Analysis' },
  { keys: ['phone'], id: 'phone', label: 'Phone' },
  { keys: ['email'], id: 'email', label: 'Email' },
  { keys: ['aml'], id: 'aml', label: 'AML' },
  { keys: ['nfc'], id: 'nfc', label: 'NFC' },
  { keys: ['poa', 'proof_of_address'], id: 'poa', label: 'Proof of address' },
]

function featureRecord(decision: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = decision[key]
    if (Array.isArray(value)) {
      const first = asRecord(value[0])
      if (first) return first
    }
    const one = asRecord(value)
    if (one) return one
  }
  return null
}

function httpsUrl(value: unknown): string {
  const url = str(value)
  if (!url.startsWith('https://')) return ''
  return url
}

function warningsFrom(feature: Record<string, unknown> | null): KycWarning[] {
  if (!feature || !Array.isArray(feature.warnings)) return []
  const out: KycWarning[] = []
  for (const item of feature.warnings) {
    const warning = asRecord(item)
    if (!warning) continue
    const title = str(warning.short_description || warning.risk || warning.feature)
    const detail = str(warning.long_description || warning.description)
    if (!title && !detail) continue
    out.push({ title: title || detail, detail: detail && detail !== title ? detail : '' })
  }
  return out
}

function passedFromStatus(status: string): boolean | null {
  const value = status.trim().toLowerCase()
  if (!value) return null
  if (['approved', 'success', 'passed', 'clear'].includes(value)) return true
  if (['declined', 'rejected', 'failed', 'error'].includes(value)) return false
  return null
}

function field(label: string, value: unknown): { label: string; value: string } | null {
  const text = str(value)
  if (!text) return null
  return { label, value: text }
}

function checkFields(id: string, feature: Record<string, unknown>): Array<{ label: string; value: string }> {
  const pairs =
    id === 'id'
      ? [
          field('Document', titleCase(str(feature.document_type || feature.documentType))),
          field('Issuing state', str(feature.issuing_state_name || feature.issuing_state || feature.nationality)),
          field('Nationality', str(feature.nationality)),
          field('Full name', str(feature.full_name || [feature.first_name, feature.last_name].filter(Boolean).join(' '))),
        ]
      : id === 'liveness' || id === 'face'
        ? [field('Score', feature.score), field('Method', feature.method)]
        : id === 'ip'
          ? [
              field('Country', feature.ip_country || feature.country),
              field('VPN or Tor', feature.is_vpn_or_tor == null ? '' : feature.is_vpn_or_tor ? 'Yes' : 'No'),
              field('Device', feature.device_brand || feature.device_model || feature.os),
            ]
          : id === 'phone'
            ? [field('Status', feature.status)]
            : id === 'email'
              ? [field('Status', feature.status)]
              : [field('Status', feature.status)]
  return pairs.filter((item): item is { label: string; value: string } => item !== null)
}

function parseChecks(decision: unknown): KycCheck[] {
  const record = asRecord(decision)
  if (!record) return []
  const checks: KycCheck[] = []
  for (const def of CHECK_DEFS) {
    const feature = featureRecord(record, def.keys)
    if (!feature) continue
    const status = str(feature.status)
    checks.push({
      id: def.id,
      label: def.label,
      status: status ? titleCase(status) : 'Pending',
      passed: passedFromStatus(status),
      score: str(feature.score),
      warnings: warningsFrom(feature),
      fields: checkFields(def.id, feature),
    })
  }
  return checks
}

function identitySummary(decision: unknown): {
  documentType: string
  issuingState: string
  legalName: string
  portraitUrl: string
} {
  const idv = firstIdVerification(decision)
  const record = asRecord(decision)
  const liveness = record ? featureRecord(record, ['liveness']) : null
  const documentType = idv
    ? titleCase(str(idv.document_type || idv.documentType || idv.doc_type))
    : ''
  const issuingState = idv
    ? str(idv.issuing_state_name || idv.issuing_state || idv.nationality || idv.country)
    : ''
  const legalName = idv
    ? str(idv.full_name || [idv.first_name, idv.last_name].filter(Boolean).join(' '))
    : ''
  const portraitUrl =
    httpsUrl(liveness?.reference_image) ||
    httpsUrl(liveness?.portrait_image) ||
    httpsUrl(idv?.portrait_image)
  return { documentType, issuingState, legalName, portraitUrl }
}

export function parseKycVerification(
  id: string,
  data: Record<string, unknown>,
): KycVerification | null {
  const status = str(data.kycStatus).toLowerCase()
  const sessionId = str(data.kycSessionId)
  if (!status && !sessionId) return null

  const user = parseAppUser(id, data)
  const bucket = kycBucket(status || 'pending')
  const identity = identitySummary(data.kycDecision)
  const checks = parseChecks(data.kycDecision)
  const warnings = checks.flatMap(check => check.warnings)
  const documentLabel = [identity.issuingState, identity.documentType].filter(Boolean).join(' · ') || 'KYC'
  const nameFromAccount = user.name && user.name !== '—' ? user.name : ''
  return {
    id,
    name: nameFromAccount || identity.legalName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: status || 'pending',
    bucket,
    label: BUCKET_LABEL[bucket],
    sessionId,
    rejectionReason: str(data.kycRejectionReason),
    updatedAt: tsToIso(data.kycUpdatedAt),
    documentLabel,
    documentType: identity.documentType,
    issuingState: identity.issuingState,
    portraitUrl: identity.portraitUrl,
    checks,
    warnings,
  }
}

export function countKyc(rows: KycVerification[]): KycCounts {
  const counts: KycCounts = {
    all: rows.length,
    approved: 0,
    inReview: 0,
    notStarted: 0,
    inProgress: 0,
    declined: 0,
    expired: 0,
    other: 0,
  }
  for (const row of rows) {
    switch (row.bucket) {
      case 'approved':
        counts.approved += 1
        break
      case 'in_review':
      case 'resubmitted':
        counts.inReview += 1
        break
      case 'not_started':
        counts.notStarted += 1
        break
      case 'in_progress':
        counts.inProgress += 1
        break
      case 'declined':
        counts.declined += 1
        break
      case 'expired':
        counts.expired += 1
        break
      default:
        counts.other += 1
        break
    }
  }
  return counts
}

export function kycVolume(rows: KycVerification[], now = Date.now()): KycVolume {
  const day = 24 * 60 * 60 * 1000
  const lastStart = now - 30 * day
  const prevStart = now - 60 * day
  let last30 = 0
  let previous30 = 0
  for (const row of rows) {
    if (!row.updatedAt) continue
    const t = new Date(row.updatedAt).getTime()
    if (Number.isNaN(t)) continue
    if (t >= lastStart) last30 += 1
    else if (t >= prevStart) previous30 += 1
  }
  const changePercent =
    previous30 === 0 ? null : Math.round(((last30 - previous30) / previous30) * 100)
  return { last30, previous30, changePercent }
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'No update yet'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'No update yet'
  const seconds = Math.max(0, Math.round((now - t) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `about ${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(months / 12)
  return `about ${years} year${years === 1 ? '' : 's'} ago`
}

export function displayName(row: KycVerification): string {
  if (row.name) return row.name
  if (row.email) return row.email
  if (row.sessionId) return row.sessionId
  return row.id
}

export function kycTone(bucket: KycBucket): { bg: string; color: string } {
  switch (bucket) {
    case 'approved':
      return { bg: '#ECFDF5', color: '#166534' }
    case 'in_review':
    case 'resubmitted':
      return { bg: '#FFF7ED', color: '#C2410C' }
    case 'declined':
      return { bg: '#FEF2F2', color: '#991B1B' }
    case 'in_progress':
      return { bg: '#EFF6FF', color: '#1D4ED8' }
    default:
      return { bg: '#F1F5F9', color: '#475569' }
  }
}
