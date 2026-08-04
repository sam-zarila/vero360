import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

export type LatestArrival = {
  id: number
  name: string
  image?: string | null
  price: number
  createdAt?: string | null
  merchantName?: string | null
  merchantEmail?: string | null
  merchantFirebaseUid?: string | null
}

export function parseLatestArrivals(body: unknown): LatestArrival[] {
  return unwrapList(body)
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => {
      const merchant =
        item.merchant && typeof item.merchant === 'object'
          ? (item.merchant as Record<string, unknown>)
          : null

      const priceRaw = item.price
      const price =
        typeof priceRaw === 'number'
          ? priceRaw
          : Number(String(priceRaw ?? 0).replace(/,/g, '')) || 0

      return {
        id: Number(item.id) || 0,
        name: String(item.name ?? item.title ?? ''),
        image: item.image != null ? String(item.image) : null,
        price,
        createdAt: item.createdAt?.toString() ?? null,
        merchantName: [
          merchant?.businessName,
          merchant?.name,
          merchant?.displayName,
        ]
          .map(v => v?.toString().trim())
          .find(v => !!v) ?? null,
        merchantEmail: merchant?.email?.toString().trim() || null,
        merchantFirebaseUid: merchant?.firebaseUid?.toString().trim() || null,
      } satisfies LatestArrival
    })
    .filter(item => item.id > 0 && item.name.trim().length > 0)
}

export function resolveLatestImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export { formatMwk, formatDateTime }
