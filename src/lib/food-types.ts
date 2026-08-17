export type FoodSource = 'api' | 'marketplace' | 'menu'

export type FoodItem = {
  /** Stable admin key: `${source}:${rawId}` */
  key: string
  rawId: string
  source: FoodSource
  name: string
  image: string | null
  gallery: string[]
  restaurant: string
  price: number
  description: string | null
  category: string
  merchantId: string | null
  location: string | null
  available: boolean
  latitude: number | null
  longitude: number | null
  createdAt: string | null
}

export type PublicFoodDetail = FoodItem
