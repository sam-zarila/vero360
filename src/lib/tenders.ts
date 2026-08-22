export type TenderSource = 'malawitenders' | 'maneps' | 'ppda' | 'manual' | string

export type Tender = {
  id: string
  title: string
  description: string
  buyer: string | null
  reference: string | null
  location: string | null
  publishedAt: string | null
  closingAt: string | null
  tenderUrl: string
  documentUrl: string | null
  source: TenderSource
  externalId: string
  active: boolean
  createdAt: string | null
  updatedAt: string | null
  syncedAt: string | null
}

export type TenderInput = {
  title: string
  description?: string
  buyer?: string | null
  reference?: string | null
  location?: string | null
  publishedAt?: string | null
  closingAt?: string | null
  tenderUrl: string
  documentUrl?: string | null
  source?: TenderSource
  externalId?: string
  active?: boolean
}

export function sourceLabel(source: TenderSource) {
  switch (String(source).toLowerCase()) {
    case 'malawitenders':
      return 'MalawiTenders'
    case 'maneps':
      return 'MANEPS'
    case 'ppda':
      return 'PPDA'
    case 'manual':
      return 'Posted by admin'
    default:
      return source || 'Unknown'
  }
}

export function formatTenderDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function isClosingSoon(closingAt?: string | null, withinDays = 7) {
  if (!closingAt) return false
  const d = new Date(closingAt)
  if (Number.isNaN(d.getTime())) return false
  const now = Date.now()
  const diff = d.getTime() - now
  return diff >= 0 && diff <= withinDays * 24 * 60 * 60 * 1000
}

export function isClosed(closingAt?: string | null) {
  if (!closingAt) return false
  const d = new Date(closingAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}
