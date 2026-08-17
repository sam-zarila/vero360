import type { Metadata } from 'next'
import { parseStayListings } from '@/lib/stay'
import {
  formatMwk,
  readJsonSafe,
  resolveVeroMediaUrl,
  unwrapList,
  veroEndpoint,
} from '@/lib/vero-api'

export type ListingKind = 'accommodation' | 'marketplace'

export type ListingQuery = Record<string, string | string[] | undefined>

export type ListingModel = {
  kind: ListingKind
  id: string
  name: string
  location: string
  price: string
  period: string
  image: string
  gallery: string[]
  description: string
  amenities: string[]
  type: string
  hostName: string
  appHref: string
  title: string
  subtitle: string
}

export type ListingPageProps = {
  params?: Promise<{ id?: string }>
  searchParams?: Promise<ListingQuery>
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim()
  return (value ?? '').trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function listingRows(body: unknown): Record<string, unknown>[] {
  const list = unwrapList(body)
  if (list.length) {
    return list
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => !!row)
  }
  const rec = asRecord(body)
  if (!rec) return []
  const nested =
    asRecord(rec.data) || asRecord(rec.item) || asRecord(rec.accommodation)
  if (nested) return [nested]
  if (rec.id != null || rec.name != null) return [rec]
  return []
}

function parseAmenities(row: Record<string, unknown> | null): string[] {
  if (!row) return []
  const raw = row.amenities ?? row.servicesOffered ?? row.facilities ?? row.features
  if (Array.isArray(raw)) {
    return raw.map(x => String(x).trim()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

function periodSuffix(period: string | null | undefined): string {
  const p = (period ?? '').toLowerCase()
  if (p === 'day') return '/ day'
  if (p === 'month') return '/ month'
  if (p === 'night' || p) return p ? `/ ${p}` : '/ night'
  return '/ night'
}

async function fetchStayById(id: string) {
  const n = Number(id)
  if (!Number.isFinite(n) || n <= 0) return null

  const headers = { Accept: 'application/json' }
  const urls = [veroEndpoint('accommodations', n), veroEndpoint('accommodations', 'all')]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers,
        next: { revalidate: 60 },
      })
      if (!res.ok) continue
      const body = await readJsonSafe(res)
      const items = parseStayListings(listingRows(body))
      const stay = items.find(item => item.id === n)
      if (!stay) continue
      const raw = listingRows(body).find(row => Number(row.id ?? row.ID) === n) ?? null
      return { stay, amenities: parseAmenities(raw) }
    } catch {
      // try next url
    }
  }
  return null
}

export async function listingFromProps(
  kind: ListingKind,
  props: ListingPageProps,
): Promise<ListingModel> {
  const params = (await props.params) ?? {}
  const query = (await props.searchParams) ?? {}
  const id = (params.id ?? '').trim()
  let name = first(query.name)
  let location = first(query.loc)
  let price = first(query.price)
  let period = first(query.period)
  let image = first(query.img)
  let description = ''
  let amenities: string[] = []
  let type = ''
  let hostName = ''
  let gallery: string[] = []

  if (kind === 'accommodation' && id) {
    const fetched = await fetchStayById(id)
    if (fetched) {
      const { stay } = fetched
      name = stay.name || name
      location = stay.location && stay.location !== '—' ? stay.location : location
      if (stay.price > 0) price = String(stay.price)
      period = periodSuffix(stay.pricingPeriod)
      image = resolveVeroMediaUrl(stay.image) || image
      gallery = stay.gallery
        .map(src => resolveVeroMediaUrl(src) || '')
        .filter(src => src && src !== image)
      description = stay.description || ''
      amenities = fetched.amenities
      type = stay.accommodationType || ''
      hostName = stay.hostName || ''
    }
  }

  if (!name) name = first(query.q)
  if (!image && gallery[0]) image = gallery[0]
  if (image) image = resolveVeroMediaUrl(image) || image

  const appPath = kind === 'marketplace' ? 'marketplace' : 'accommodation'
  const title =
    name || (kind === 'marketplace' ? 'Listing on Vero360' : 'Stay on Vero360')
  const subtitle =
    [location, description].filter(Boolean).join(' · ') ||
    (kind === 'marketplace'
      ? 'Open this listing in the Vero360 app, or view it here.'
      : 'Open this stay in the Vero360 app, or view it here.')

  return {
    kind,
    id,
    name,
    location,
    price,
    period,
    image,
    gallery,
    description,
    amenities,
    type,
    hostName,
    appHref: `vero360://${appPath}${id ? `/${id}` : ''}`,
    title,
    subtitle,
  }
}

export async function listingMetadata(
  kind: ListingKind,
  props: ListingPageProps,
): Promise<Metadata> {
  const listing = await listingFromProps(kind, props)
  const path =
    kind === 'marketplace'
      ? `/marketplace/${listing.id}`
      : `/accommodation/${listing.id}`
  const imageIsHttp = /^https?:\/\//i.test(listing.image)

  return {
    title: `${listing.title} · Vero360`,
    description: listing.subtitle,
    openGraph: {
      title: listing.title,
      description: listing.subtitle,
      url: `https://vero360.app${path}`,
      siteName: 'Vero360',
      type: 'website',
      images: imageIsHttp ? [{ url: listing.image }] : undefined,
    },
  }
}

export function listingPriceLabel(listing: ListingModel) {
  const n = Number(String(listing.price).replace(/,/g, ''))
  if (Number.isFinite(n) && n > 0) {
    const suffix = listing.period.startsWith('/')
      ? ` ${listing.period}`
      : listing.period
        ? ` ${listing.period}`
        : ' / night'
    return `${formatMwk(n)}${suffix}`
  }
  if (!listing.price) return ''
  return `MWK ${listing.price}${listing.period ? ` ${listing.period}` : ''}`
}
