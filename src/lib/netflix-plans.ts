import type { DigitalProductPriceConfig } from '@/lib/digital-services-config'

export type NetflixPlanSpec = {
  key: string
  title: string
  qualityLabel: string
  resolution: string
  supportedDevices: string
  simultaneousStreams: number
  downloadDevices: number
  spatialAudio: boolean
  mostPopular: boolean
  featureLines: string[]
}

function features(spec: Omit<NetflixPlanSpec, 'featureLines'>): NetflixPlanSpec {
  return {
    ...spec,
    featureLines: [
      `Video and sound quality: ${spec.qualityLabel}`,
      `Resolution: ${spec.resolution}`,
      ...(spec.spatialAudio
        ? ['Spatial audio (immersive sound): included']
        : []),
      `Supported devices: ${spec.supportedDevices}`,
      `Devices your household can watch at the same time: ${spec.simultaneousStreams}`,
      `Download devices: ${spec.downloadDevices}`,
    ],
  }
}

export const NETFLIX_PLAN_SPECS: NetflixPlanSpec[] = [
  features({
    key: 'netflix_mobile',
    title: 'Mobile 480p',
    qualityLabel: 'Fair',
    resolution: '480p',
    supportedDevices: 'Mobile phone, tablet',
    simultaneousStreams: 1,
    downloadDevices: 1,
    spatialAudio: false,
    mostPopular: false,
  }),
  features({
    key: 'netflix_basic',
    title: 'Basic 720p',
    qualityLabel: 'Good',
    resolution: '720p (HD)',
    supportedDevices: 'TV, computer, mobile phone, tablet',
    simultaneousStreams: 1,
    downloadDevices: 1,
    spatialAudio: false,
    mostPopular: false,
  }),
  features({
    key: 'netflix_standard',
    title: 'Standard 1080p',
    qualityLabel: 'Great',
    resolution: '1080p (Full HD)',
    supportedDevices: 'TV, computer, mobile phone, tablet',
    simultaneousStreams: 2,
    downloadDevices: 2,
    spatialAudio: false,
    mostPopular: false,
  }),
  features({
    key: 'netflix_premium',
    title: 'Premium 4K + HDR',
    qualityLabel: 'Best',
    resolution: '4K (Ultra HD) + HDR',
    supportedDevices: 'TV, computer, mobile phone, tablet',
    simultaneousStreams: 4,
    downloadDevices: 6,
    spatialAudio: true,
    mostPopular: true,
  }),
]

export function isNetflixHubKey(key: string): boolean {
  return key.trim().toLowerCase() === 'netflix'
}

export function isNetflixPlanKey(key: string): boolean {
  return key.trim().toLowerCase().startsWith('netflix_')
}

export type NetflixPlanPublicCard = {
  spec: NetflixPlanSpec
  productKey: string
  name: string
  priceMwk: number
  href: string
}

/** Active Netflix plans with admin prices for the public chooser. */
export function buildPublicNetflixPlans(
  products: DigitalProductPriceConfig[],
): NetflixPlanPublicCard[] {
  const byKey = new Map(products.map(p => [p.key, p]))
  const out: NetflixPlanPublicCard[] = []
  for (const spec of NETFLIX_PLAN_SPECS) {
    const p = byKey.get(spec.key)
    if (p && p.active === false) continue
    const price =
      typeof p?.fixedMwkPrice === 'number' && p.fixedMwkPrice > 0
        ? Math.round(p.fixedMwkPrice)
        : 0
    if (price <= 0 && p?.active === false) continue
    // Prefer admin price; fall back to defaults from config name if missing.
    const fallback =
      spec.key === 'netflix_mobile'
        ? 8000
        : spec.key === 'netflix_basic'
          ? 12000
          : spec.key === 'netflix_standard'
            ? 15000
            : 20000
    out.push({
      spec,
      productKey: spec.key,
      name: p?.name || `Netflix ${spec.title}`,
      priceMwk: price > 0 ? price : fallback,
      href: `/digital-services/${encodeURIComponent(spec.key)}`,
    })
  }
  return out
}
