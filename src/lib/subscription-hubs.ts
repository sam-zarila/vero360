import type { DigitalProductPriceConfig } from '@/lib/digital-services-config'

export type HubPlanPublicCard = {
  productKey: string
  hubKey: string
  hubName: string
  /** Full order title, e.g. Claude · Student */
  name: string
  /** Short plan label on the picker, e.g. Student */
  planLabel: string
  badge: string
  recommended: boolean
  featureLines: string[]
  priceMwk: number
  href: string
  imageUrl?: string
}

/** Built-in hubs that always open a plan picker. */
export function isBuiltInSubscriptionHub(key: string): boolean {
  const k = key.trim().toLowerCase()
  return k === 'chatgpt' || k === 'netflix'
}

export function isSubscriptionHubProduct(
  product: Pick<DigitalProductPriceConfig, 'key' | 'isHub' | 'fixedMwkPrice'>,
): boolean {
  if (isBuiltInSubscriptionHub(product.key)) return true
  if (product.isHub === true) return true
  return false
}

/** Child plans live under a hub — never as their own browse cards. */
export function isSubscriptionPlanProduct(
  product: Pick<DigitalProductPriceConfig, 'key' | 'hubKey'>,
): boolean {
  const hub = String(product.hubKey || '').trim()
  if (hub) return true
  const k = String(product.key || '').trim().toLowerCase()
  return (
    k.startsWith('netflix_') ||
    k === 'chatgpt_basic' ||
    k === 'chatgpt_plus' ||
    /_(student|private|basic|plus|mobile|standard|premium)$/i.test(k)
  )
}

function stripPlanNoise(label: string): string {
  return label
    .replace(/\bplan\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build "Claude · Student" even if admin typed only "Student". */
export function formatHubPlanProductName(hubName: string, planLabel: string): string {
  const brand = hubName.trim() || 'Subscription'
  const plan = stripPlanNoise(planLabel) || 'Plan'
  if (!plan) return brand
  const lowerPlan = plan.toLowerCase()
  const lowerBrand = brand.toLowerCase()
  if (lowerPlan === lowerBrand || lowerPlan.startsWith(`${lowerBrand} `) || lowerPlan.includes(`·`)) {
    return plan
  }
  return `${brand} · ${plan}`
}

export function planLabelFromProductName(productName: string, hubName?: string | null): string {
  const name = productName.trim()
  if (!name) return 'Plan'
  if (name.includes('·')) {
    const parts = name.split('·')
    return stripPlanNoise(parts[parts.length - 1] || name) || name
  }
  const brand = (hubName || '').trim()
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
    return stripPlanNoise(name.slice(brand.length).replace(/^[\s\-–—:]+/, '')) || name
  }
  return stripPlanNoise(name) || name
}

export function buildPublicHubPlans(
  hubKey: string,
  products: DigitalProductPriceConfig[],
): HubPlanPublicCard[] {
  const hub = products.find(p => p.key === hubKey)
  const hubName = hub?.name?.trim() || hubKey
  const plans = products.filter(
    p =>
      p.active !== false &&
      (p.hubKey === hubKey ||
        (hubKey === 'chatgpt' && (p.key === 'chatgpt_basic' || p.key === 'chatgpt_plus')) ||
        (hubKey === 'netflix' && p.key.startsWith('netflix_'))),
  )

  return plans
    .map(p => {
      const planLabel =
        planLabelFromProductName(p.name, hubName) ||
        stripPlanNoise(p.planBadge || p.brandTag || 'Plan') ||
        'Plan'
      const price =
        typeof p.fixedMwkPrice === 'number' && p.fixedMwkPrice > 0
          ? Math.round(p.fixedMwkPrice)
          : 0
      return {
        productKey: p.key,
        hubKey,
        hubName,
        name: formatHubPlanProductName(hubName, planLabel),
        planLabel,
        badge: (p.planBadge || p.brandTag || planLabel).trim() || planLabel,
        recommended: p.recommended === true,
        featureLines:
          Array.isArray(p.featureLines) && p.featureLines.length
            ? p.featureLines
            : String(p.subtitle || '')
                .split(/[·|]/)
                .map(s => s.trim())
                .filter(Boolean),
        priceMwk: price,
        href: `/digital-services/${encodeURIComponent(p.key)}`,
        imageUrl: p.imageUrl || hub?.imageUrl,
      }
    })
    .filter(p => p.priceMwk > 0)
    .sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
      return a.priceMwk - b.priceMwk
    })
}

/** Title shown in admin orders / emails. */
export function digitalOrderDisplayName(order: {
  productName?: string | null
  brandTag?: string | null
  hubName?: string | null
  planBadge?: string | null
  category?: string | null
  kind?: string | null
  selectedUsd?: number | null
  unitLabel?: string | null
}): string {
  const stored = String(order.productName || '').trim()
  const hub = String(order.hubName || '').trim()
  const plan = String(order.planBadge || order.brandTag || '').trim()
  const cat = String(order.category || order.kind || '').toLowerCase()

  if (hub && plan) {
    const composed = formatHubPlanProductName(hub, plan)
    if (!stored || stored.toLowerCase() === plan.toLowerCase() || stored.toLowerCase() === 'student plan' || stored.toLowerCase() === 'private plan') {
      return composed
    }
    if (!stored.toLowerCase().includes(hub.toLowerCase())) {
      return formatHubPlanProductName(hub, stored)
    }
  }

  if (hub && stored && !stored.toLowerCase().includes(hub.toLowerCase())) {
    return formatHubPlanProductName(hub, stored)
  }

  if ((cat === 'crypto' || cat === 'fx') && order.selectedUsd && order.selectedUsd > 0) {
    const unit = String(order.unitLabel || order.brandTag || stored || 'Crypto').trim()
    const base = stored && !/^\d+(\.\d+)?$/.test(stored) ? stored : unit
    if (!base.includes(String(order.selectedUsd))) {
      return `${base} · ${order.selectedUsd}`
    }
  }

  return stored || hub || plan || 'Digital product'
}
