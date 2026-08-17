import type { Metadata } from 'next'

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

export async function listingFromProps(
  kind: ListingKind,
  props: ListingPageProps,
): Promise<ListingModel> {
  const params = (await props.params) ?? {}
  const query = (await props.searchParams) ?? {}
  const id = (params.id ?? '').trim()
  const name = first(query.name) || first(query.q)
  const location = first(query.loc)
  const price = first(query.price)
  const period = first(query.period)
  const image = first(query.img)
  const appPath = kind === 'marketplace' ? 'marketplace' : 'accommodation'
  const title =
    name || (kind === 'marketplace' ? 'Listing on Vero360' : 'Stay on Vero360')
  const subtitle =
    location ||
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
