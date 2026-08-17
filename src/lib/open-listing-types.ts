export type ListingKind = 'accommodation' | 'marketplace' | 'shop' | 'food'

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
  sellerImage: string
  shopId: string
  appHref: string
  title: string
  subtitle: string
}

export type ListingPageProps = {
  params?: Promise<{ id?: string }>
  searchParams?: Promise<ListingQuery>
}
