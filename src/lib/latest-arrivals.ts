import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

/** Same window as the Flutter app (`Duration(hours: 24)`). */
export const LATEST_ARRIVAL_WINDOW_MS = 24 * 60 * 60 * 1000

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

/**
 * Match Flutter `LatestArrivalServices` / merchant services:
 * keep only items with createdAt in the last 24 hours.
 * If no row has a timestamp, fall back to the full list (same as the app).
 */
export function filterLatestArrivalsLast24h(
  items: LatestArrival[],
  now = Date.now(),
): LatestArrival[] {
  const cutoff = now - LATEST_ARRIVAL_WINDOW_MS
  const withDates = items.filter(it => {
    if (!it.createdAt) return false
    const t = new Date(it.createdAt).getTime()
    return Number.isFinite(t)
  })

  if (withDates.length === 0) {
    return [...items].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })
  }

  return withDates
    .filter(it => {
      const t = new Date(it.createdAt!).getTime()
      return t >= cutoff
    })
    .sort((a, b) => {
      const at = new Date(a.createdAt!).getTime()
      const bt = new Date(b.createdAt!).getTime()
      return bt - at
    })
}

/** Human remaining time until the 24h window ends (e.g. "5h 12m left"). */
export function latestArrivalTimeLeft(createdAt?: string | null, now = Date.now()) {
  if (!createdAt) return null
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return null
  const ends = t + LATEST_ARRIVAL_WINDOW_MS
  const left = ends - now
  if (left <= 0) return 'Expired'
  const hours = Math.floor(left / (60 * 60 * 1000))
  const mins = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000))
  if (hours <= 0) return `${mins}m left`
  return `${hours}h ${mins}m left`
}

export function resolveLatestImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export { formatMwk, formatDateTime }
