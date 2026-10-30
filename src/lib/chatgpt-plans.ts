import type { DigitalProductPriceConfig } from '@/lib/digital-services-config'

export type ChatGptPlanSpec = {
  key: string
  title: string
  badge: string
  recommended: boolean
  featureLines: string[]
}

export const CHATGPT_PLAN_SPECS: ChatGptPlanSpec[] = [
  {
    key: 'chatgpt_basic',
    title: 'Basic ChatGPT Plus',
    badge: 'For students',
    recommended: true,
    featureLines: [
      'Shared account for Students',
      'Best for assignments and school work',
      'One shared login, so chats are not private',
    ],
  },
  {
    key: 'chatgpt_plus',
    title: 'ChatGPT Plus',
    badge: 'Private',
    recommended: false,
    featureLines: [
      'Your own account. Not shared with anyone',
      'Best for work and personal use',
      'Your chats stay private',
    ],
  },
]

export function isChatGptHubKey(key: string): boolean {
  return key.trim().toLowerCase() === 'chatgpt'
}

export function isChatGptPlanKey(key: string): boolean {
  const k = key.trim().toLowerCase()
  return k === 'chatgpt_basic' || k === 'chatgpt_plus'
}

export type ChatGptPlanPublicCard = {
  spec: ChatGptPlanSpec
  productKey: string
  name: string
  priceMwk: number
  href: string
}

/** Active ChatGPT plans with admin prices for the public chooser. */
export function buildPublicChatGptPlans(
  products: DigitalProductPriceConfig[],
): ChatGptPlanPublicCard[] {
  const byKey = new Map(products.map(p => [p.key, p]))
  const out: ChatGptPlanPublicCard[] = []
  for (const spec of CHATGPT_PLAN_SPECS) {
    const p = byKey.get(spec.key)
    if (p && p.active === false) continue
    const price =
      typeof p?.fixedMwkPrice === 'number' && p.fixedMwkPrice > 0
        ? Math.round(p.fixedMwkPrice)
        : 0
    const fallback = spec.key === 'chatgpt_basic' ? 10000 : 65000
    out.push({
      spec,
      productKey: spec.key,
      name: p?.name || spec.title,
      priceMwk: price > 0 ? price : fallback,
      href: `/digital-services/${encodeURIComponent(spec.key)}`,
    })
  }
  return out
}
