import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
  VERO_API_BASE,
} from '@/lib/vero-api'

/** @deprecated import from `@/lib/vero-api` instead */
export { VERO_API_BASE, formatMwk, formatDateTime as formatPromoDate, resolveVeroMediaUrl as resolvePromoImage }

export type Promo = {
  id: number
  merchantId: string | number
  merchantName?: string | null
  merchantEmail?: string | null
  merchantFirebaseUid?: string | null
  title: string
  description?: string | null
  image?: string | null
  price: number
  isActive: boolean
  startDate?: string | null
  endDate?: string | null
  createdAt?: string | null
}

export function postedByLabel(promo: Promo) {
  const name = promo.merchantName?.trim()
  if (name) return name
  const email = promo.merchantEmail?.trim()
  if (email) return email
  return 'Unknown merchant'
}

export function postedByEmail(promo: Promo) {
  return promo.merchantEmail?.trim() || '—'
}

export function parsePromoList(body: unknown): Promo[] {
  return unwrapList(body)
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => {
      const priceRaw = item.price ?? item.amount ?? item.promoPrice
      const price =
        typeof priceRaw === 'number'
          ? priceRaw
          : Number(String(priceRaw ?? 0).replace(/,/g, '')) || 0

      const merchant =
        item.merchant && typeof item.merchant === 'object'
          ? (item.merchant as Record<string, unknown>)
          : null

      const merchantId = (item.merchantId as string | number) ?? merchant?.id ?? ''
      const merchantFirebaseUid = [
        item.merchantFirebaseUid,
        item.merchantUid,
        item.sellerUserId,
        merchant?.firebaseUid,
        merchant?.uid,
        merchant?.merchantUid,
        typeof merchantId === 'string' && !/^\d+$/.test(String(merchantId)) ? merchantId : null,
      ]
        .map(v => v?.toString().trim())
        .find(v => !!v && v.length >= 8) ?? null

      const merchantName = [
        item.merchantName,
        item.merchantBusinessName,
        merchant?.businessName,
        merchant?.merchantName,
        merchant?.name,
        merchant?.displayName,
      ]
        .map(v => v?.toString().trim())
        .find(v => !!v) ?? null

      const merchantEmail = [
        item.merchantEmail,
        merchant?.email,
      ]
        .map(v => v?.toString().trim())
        .find(v => !!v) ?? null

      return {
        id: Number(item.id) || 0,
        merchantId,
        merchantName,
        merchantEmail,
        merchantFirebaseUid,
        title: String(item.title ?? ''),
        description: item.description != null ? String(item.description) : null,
        image: item.image != null ? String(item.image) : null,
        price,
        isActive: item.isActive !== false,
        startDate: (item.startDate ?? item.startsAt)?.toString() ?? null,
        endDate: (item.endDate ?? item.endsAt)?.toString() ?? null,
        createdAt: item.createdAt?.toString() ?? null,
      } satisfies Promo
    })
    .filter(p => p.id > 0 && p.title.trim().length > 0)
}

export function unwrapPromo(body: unknown): Promo | null {
  const map =
    body && typeof body === 'object' && (body as { data?: unknown }).data && typeof (body as { data: unknown }).data === 'object'
      ? (body as { data: Record<string, unknown> }).data
      : (body as Record<string, unknown> | null)

  if (!map || typeof map !== 'object') return null
  const list = parsePromoList([map])
  return list[0] ?? null
}
