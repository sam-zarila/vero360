/** Marketing growth campaigns — Firestore `marketing_campaigns`. */

export const MARKETING_CAMPAIGNS_COLLECTION = 'marketing_campaigns'

export type MarketingCampaignStatus = 'draft' | 'active' | 'paused' | 'ended'

export type MarketingCampaign = {
  id: string
  name: string
  status: MarketingCampaignStatus
  objective: string
  channels: string[]
  startDate: string | null
  endDate: string | null
  ownerUid: string | null
  ownerName: string | null
  budgetMwk: number | null
  utmSource: string
  utmMedium: string
  utmCampaign: string
  landingPath: string
  notes: string
  audience: string
  creativeNotes: string
  cta: string
  targetInstalls: number | null
  targetSignups: number | null
  createdByUid: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CreateMarketingCampaignInput = {
  name: string
  status?: MarketingCampaignStatus | string
  objective?: string
  channels?: string[]
  startDate?: string | null
  endDate?: string | null
  ownerUid?: string | null
  ownerName?: string | null
  budgetMwk?: number | null
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  landingPath?: string
  notes?: string
  audience?: string
  creativeNotes?: string
  cta?: string
  targetInstalls?: number | null
  targetSignups?: number | null
}

export type UpdateMarketingCampaignInput = Partial<CreateMarketingCampaignInput>

export const MARKETING_CAMPAIGN_STATUSES: MarketingCampaignStatus[] = [
  'draft',
  'active',
  'paused',
  'ended',
]

export const MARKETING_CAMPAIGN_CHANNELS = [
  'Facebook',
  'Instagram',
  'TikTok',
  'Buffer',
  'Email',
  'WhatsApp',
  'Radio',
  'Outdoor',
  'Influencer',
  'Organic',
  'Other',
] as const

export function normalizeMarketingCampaignStatus(
  value: unknown,
): MarketingCampaignStatus {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (raw === 'active') return 'active'
  if (raw === 'paused' || raw === 'pause') return 'paused'
  if (raw === 'ended' || raw === 'complete' || raw === 'completed') return 'ended'
  return 'draft'
}

export function slugifyCampaign(name: string): string {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || `campaign-${Date.now().toString(36)}`
}

export function buildTrackedLinks(campaign: Pick<
  MarketingCampaign,
  'utmSource' | 'utmMedium' | 'utmCampaign' | 'landingPath'
>, opts?: { siteOrigin?: string; playStoreUrl?: string }) {
  const origin = (opts?.siteOrigin || 'https://vero360.app').replace(/\/$/, '')
  const play =
    opts?.playStoreUrl ||
    'https://play.google.com/store/apps/details?id=com.vero265.app'
  const path = campaign.landingPath?.startsWith('/')
    ? campaign.landingPath
    : `/${campaign.landingPath || ''}`
  const params = new URLSearchParams({
    utm_source: campaign.utmSource || 'marketing',
    utm_medium: campaign.utmMedium || 'campaign',
    utm_campaign: campaign.utmCampaign,
  })
  const website = `${origin}${path === '/' ? '' : path}?${params.toString()}`
  const deepLink = website
  const referrer = encodeURIComponent(
    `utm_source=${campaign.utmSource}&utm_medium=${campaign.utmMedium}&utm_campaign=${campaign.utmCampaign}`,
  )
  const store = `${play}${play.includes('?') ? '&' : '?'}referrer=${referrer}`
  return { website, deepLink, store, utmQuery: params.toString() }
}
