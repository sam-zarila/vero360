/** Client-safe catalog card helpers (shared by landing + browse pages). */

export type CatalogCard = {
  id: string
  title: string
  image: string | null
  price: number | null
  location: string | null
  meta: string | null
  href: string | null
  externalUrl: string | null
}

export type BrowseCatalogId =
  | 'marketplace'
  | 'food'
  | 'stays'
  | 'digital-services'
  | 'jobs'
  | 'tenders'

export const BROWSE_CATALOGS: Record<
  BrowseCatalogId,
  {
    title: string
    subtitle: string
    endpoint: string
    itemLabel: string
  }
> = {
  marketplace: {
    title: 'Marketplace',
    subtitle: 'All products from verified merchants',
    endpoint: '/api/public/marketplace?limit=500',
    itemLabel: 'products',
  },
  food: {
    title: 'Food',
    subtitle: 'Meals and restaurants on Vero360',
    endpoint: '/api/public/food?limit=500',
    itemLabel: 'meals',
  },
  stays: {
    title: 'Stay',
    subtitle: 'Hotels, lodges, and short stays',
    endpoint: '/api/public/stays?limit=500',
    itemLabel: 'stays',
  },
  'digital-services': {
    title: 'Digital Services',
    subtitle: 'Subscriptions, gift cards, and gaming top-ups',
    endpoint: '/api/public/digital-services?limit=500',
    itemLabel: 'services',
  },
  jobs: {
    title: 'Jobs',
    subtitle: 'Roles across Malawi and beyond',
    endpoint: '/api/public/jobs?limit=500',
    itemLabel: 'jobs',
  },
  tenders: {
    title: 'Tenders',
    subtitle: 'Open opportunities and RFPs',
    endpoint: '/api/tenders?limit=500',
    itemLabel: 'tenders',
  },
}

export function isBrowseCatalogId(value: string): value is BrowseCatalogId {
  return value in BROWSE_CATALOGS
}

export function mapTenderItems(raw: unknown[]): CatalogCard[] {
  return raw.map((row, i) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id ?? i),
      title: String(r.title || 'Tender'),
      image: null,
      price: null,
      location: r.location ? String(r.location) : null,
      meta: r.buyer ? String(r.buyer) : null,
      href: null,
      externalUrl: (r.tenderUrl || r.documentUrl
        ? String(r.tenderUrl || r.documentUrl)
        : null) as string | null,
    }
  })
}

/** Detail URL for open-listing pages — includes preview query for faster paint. */
export function listingDetailHref(card: CatalogCard): string | null {
  if (!card.href) return null
  const qs = new URLSearchParams()
  if (card.title) qs.set('name', card.title)
  if (card.location) qs.set('loc', card.location)
  if (card.price != null && card.price > 0) qs.set('price', String(Math.round(card.price)))
  if (card.image) qs.set('img', card.image)
  if (card.meta) qs.set('merchant', card.meta)
  const q = qs.toString()
  return q ? `${card.href}?${q}` : card.href
}
