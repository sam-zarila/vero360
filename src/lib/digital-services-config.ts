import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const DIGITAL_SERVICES_CONFIG_DOC = 'app_config/digital_services'

export type DigitalProductPriceConfig = {
  key: string
  name: string
  subtitle?: string
  category: string
  brandTag?: string
  /** Fixed MWK for subscriptions. */
  fixedMwkPrice?: number | null
  /** Face values (USD for gift cards, or units for crypto e.g. USDT). */
  usdAmounts?: number[]
  /** Custom MWK per unit (USDT/CNY/BNB). When set, overrides global USD rate. */
  mwkPerUnit?: number | null
  /** Unit label shown in app, e.g. USDT, CNY, BNB. */
  unitLabel?: string
  /** Product picture (Firebase Storage / HTTPS URL). */
  imageUrl?: string
  active?: boolean
}

export type DigitalServicesConfig = {
  usdToMwkRate: number
  products: DigitalProductPriceConfig[]
  updatedAt?: string | null
  updatedByEmail?: string | null
}

/** Defaults mirror the Flutter `digital_product.dart` catalog. */
export const DEFAULT_DIGITAL_SERVICES_CONFIG: DigitalServicesConfig = {
  usdToMwkRate: 4700,
  products: [
    {
      key: 'spotify',
      name: 'Spotify Premium',
      subtitle: '1-month subscription',
      category: 'streaming',
      brandTag: 'Spotify',
      fixedMwkPrice: 8000,
      active: true,
    },
    {
      key: 'apple_music',
      name: 'Apple Music',
      subtitle: '1-month subscription',
      category: 'streaming',
      brandTag: 'Music',
      fixedMwkPrice: 8000,
      active: true,
    },
    {
      key: 'netflix',
      name: 'Netflix',
      subtitle: '1-month subscription',
      category: 'streaming',
      brandTag: 'Netflix',
      fixedMwkPrice: 15000,
      active: true,
    },
    {
      key: 'chatgpt_plus',
      name: 'ChatGPT Plus',
      subtitle: '1-month subscription',
      category: 'streaming',
      brandTag: 'GPT',
      fixedMwkPrice: 35000,
      active: true,
    },
    {
      key: 'visa_gc',
      name: 'Visa Gift Card',
      subtitle: 'Prepaid Visa digital card',
      category: 'gift_cards',
      brandTag: 'VISA',
      usdAmounts: [10, 25, 50, 100, 200],
      active: true,
    },
    {
      key: 'paypal_gc',
      name: 'PayPal',
      subtitle: 'PayPal balance top-up',
      category: 'gift_cards',
      brandTag: 'PayPal',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
    {
      key: 'mastercard_gc',
      name: 'Mastercard Gift',
      subtitle: 'Prepaid Mastercard digital card',
      category: 'gift_cards',
      brandTag: 'MC',
      usdAmounts: [10, 25, 50, 100, 200],
      active: true,
    },
    {
      key: 'amazon_gc',
      name: 'Amazon',
      subtitle: 'Amazon gift card',
      category: 'gift_cards',
      brandTag: 'Amazon',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
    {
      key: 'itunes',
      name: 'Apple Gift Card',
      subtitle: 'App Store & iTunes',
      category: 'gift_cards',
      brandTag: 'Apple',
      usdAmounts: [10, 15, 25, 50, 100],
      active: true,
    },
    {
      key: 'steam_gc',
      name: 'Steam Wallet',
      subtitle: 'Steam wallet top-up',
      category: 'gaming',
      brandTag: 'STEAM',
      usdAmounts: [5, 10, 20, 50, 100],
      active: true,
    },
    {
      key: 'google_play',
      name: 'Google Play',
      subtitle: 'Google Play gift card',
      category: 'gaming',
      brandTag: 'Play',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
    {
      key: 'playstation',
      name: 'PlayStation',
      subtitle: 'PSN wallet gift card',
      category: 'gaming',
      brandTag: 'PSN',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
    {
      key: 'xbox',
      name: 'Xbox',
      subtitle: 'Xbox / Microsoft Store gift card',
      category: 'gaming',
      brandTag: 'Xbox',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
    {
      key: 'eneba',
      name: 'Eneba',
      subtitle: 'Eneba wallet gift card',
      category: 'gaming',
      brandTag: 'Eneba',
      usdAmounts: [10, 25, 50, 100],
      active: true,
    },
  ],
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function parseProduct(raw: unknown): DigitalProductPriceConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const key = String(d.key || '').trim()
  const name = String(d.name || '').trim()
  if (!key || !name) return null

  const category = String(d.category || 'gift_cards').trim() || 'gift_cards'
  const fixedRaw = d.fixedMwkPrice
  const fixedMwkPrice =
    fixedRaw === null || fixedRaw === undefined || fixedRaw === ''
      ? null
      : Math.max(0, Math.round(num(fixedRaw)))

  let usdAmounts: number[] | undefined
  if (Array.isArray(d.usdAmounts)) {
    usdAmounts = d.usdAmounts
      .map((x) => num(x))
      .filter((x) => x > 0)
      .map((x) => Math.round(x * 100) / 100)
  } else if (typeof d.usdAmounts === 'string') {
    usdAmounts = d.usdAmounts
      .split(/[,\s]+/)
      .map((x) => num(x.trim()))
      .filter((x) => x > 0)
  }

  const isSub = category === 'streaming' || category === 'subscription'
  const mwkPerUnitRaw = d.mwkPerUnit
  const mwkPerUnit =
    mwkPerUnitRaw === null || mwkPerUnitRaw === undefined || mwkPerUnitRaw === ''
      ? null
      : Math.max(0, Math.round(num(mwkPerUnitRaw)))
  const unitLabel = String(d.unitLabel || '').trim() || undefined
  const imageUrl = String(d.imageUrl || '').trim() || undefined

  return {
    key,
    name,
    subtitle: String(d.subtitle || '').trim() || undefined,
    category,
    brandTag: String(d.brandTag || '').trim() || undefined,
    fixedMwkPrice: isSub ? fixedMwkPrice : fixedMwkPrice || null,
    // Never leave undefined for Firestore writes — omit via sanitize instead.
    usdAmounts: isSub ? [] : usdAmounts?.length ? usdAmounts : [],
    mwkPerUnit: isSub ? null : mwkPerUnit,
    unitLabel: isSub ? undefined : unitLabel,
    imageUrl,
    active: d.active === false ? false : true,
  }
}

/** Firestore rejects `undefined` field values — only write defined keys. */
function productForFirestore(p: DigitalProductPriceConfig): Record<string, unknown> {
  const isSub = p.category === 'streaming' || p.category === 'subscription'
  const out: Record<string, unknown> = {
    key: p.key,
    name: p.name,
    category: p.category || 'gift_cards',
    // Always write a real boolean so the app can hide out-of-stock items.
    active: p.active === false ? false : true,
  }
  const subtitle = (p.subtitle || '').trim()
  if (subtitle) out.subtitle = subtitle
  const brandTag = (p.brandTag || '').trim()
  if (brandTag) out.brandTag = brandTag

  if (isSub) {
    out.fixedMwkPrice =
      p.fixedMwkPrice == null ? null : Math.max(0, Math.round(Number(p.fixedMwkPrice) || 0))
  } else {
    const amounts = Array.isArray(p.usdAmounts)
      ? p.usdAmounts
          .map((x) => num(x))
          .filter((x) => x > 0)
          .map((x) => Math.round(x * 100) / 100)
      : []
    out.usdAmounts = amounts
    out.fixedMwkPrice = p.fixedMwkPrice == null ? null : Math.max(0, Math.round(Number(p.fixedMwkPrice) || 0))
    if (p.mwkPerUnit != null && Number(p.mwkPerUnit) > 0) {
      out.mwkPerUnit = Math.max(1, Math.round(Number(p.mwkPerUnit)))
    } else {
      out.mwkPerUnit = null
    }
    const unitLabel = (p.unitLabel || '').trim()
    if (unitLabel) out.unitLabel = unitLabel
  }
  const imageUrl = (p.imageUrl || '').trim()
  if (imageUrl) out.imageUrl = imageUrl
  return out
}

function mergeWithDefaults(saved: Partial<DigitalServicesConfig> | null): DigitalServicesConfig {
  const rate = Math.max(1, num(saved?.usdToMwkRate, DEFAULT_DIGITAL_SERVICES_CONFIG.usdToMwkRate))
  const byKey = new Map<string, DigitalProductPriceConfig>()
  for (const p of DEFAULT_DIGITAL_SERVICES_CONFIG.products) {
    byKey.set(p.key, { ...p })
  }
  for (const raw of saved?.products || []) {
    const p = parseProduct(raw)
    if (!p) continue
    const prev = byKey.get(p.key)
    byKey.set(p.key, {
      ...(prev || {}),
      ...p,
      name: p.name || prev?.name || p.key,
      category: p.category || prev?.category || 'gift_cards',
    })
  }
  return {
    usdToMwkRate: rate,
    products: [...byKey.values()],
    updatedAt: saved?.updatedAt ?? null,
    updatedByEmail: saved?.updatedByEmail ?? null,
  }
}

export async function getDigitalServicesConfig(): Promise<DigitalServicesConfig> {
  try {
    const snap = await getAdminDb().doc(DIGITAL_SERVICES_CONFIG_DOC).get()
    if (!snap.exists) {
      return { ...DEFAULT_DIGITAL_SERVICES_CONFIG }
    }
    const data = snap.data() || {}
    const productsRaw = Array.isArray(data.products)
      ? data.products
      : data.products && typeof data.products === 'object'
        ? Object.values(data.products as Record<string, unknown>)
        : []

    const updatedAt = data.updatedAt?.toDate?.()
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || null

    return mergeWithDefaults({
      usdToMwkRate: num(data.usdToMwkRate, DEFAULT_DIGITAL_SERVICES_CONFIG.usdToMwkRate),
      products: productsRaw as DigitalProductPriceConfig[],
      updatedAt,
      updatedByEmail: data.updatedByEmail ? String(data.updatedByEmail) : null,
    })
  } catch (err) {
    console.error('getDigitalServicesConfig:', err)
    return { ...DEFAULT_DIGITAL_SERVICES_CONFIG }
  }
}

export async function saveDigitalServicesConfig(input: {
  usdToMwkRate: number
  products: DigitalProductPriceConfig[]
  updatedByEmail?: string
}): Promise<DigitalServicesConfig> {
  const rate = Math.max(1, Math.round(num(input.usdToMwkRate)))
  const products = input.products
    .map((p) => parseProduct(p))
    .filter((p): p is DigitalProductPriceConfig => !!p)

  if (!products.length) {
    throw new Error('At least one product is required')
  }
  if (rate < 100 || rate > 100000) {
    throw new Error('USD→MWK rate must be between 100 and 100000')
  }

  const merged = mergeWithDefaults({ usdToMwkRate: rate, products })
  const firestoreProducts = merged.products.map(productForFirestore)
  const disabledProductKeys = firestoreProducts
    .filter((p) => p.active === false)
    .map((p) => String(p.key))

  // Full replace of pricing doc fields (not merge) so inactive flags always stick.
  await getAdminDb().doc(DIGITAL_SERVICES_CONFIG_DOC).set({
    usdToMwkRate: merged.usdToMwkRate,
    products: firestoreProducts,
    disabledProductKeys,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByEmail: (input.updatedByEmail || '').trim() || null,
    source: 'admin_panel',
  })

  return getDigitalServicesConfig()
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function imageExt(contentType: string, fileName: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase()
  if (
    fromName === 'png' ||
    fromName === 'webp' ||
    fromName === 'gif' ||
    fromName === 'jpg' ||
    fromName === 'jpeg'
  ) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

/** Upload a product picture for custom gift / crypto cards. */
export async function uploadDigitalProductImage(file: File): Promise<string> {
  const { randomUUID } = await import('crypto')
  const { getAdminStorage, getAdminStorageBucket } = await import(
    '@/lib/firebase-admin'
  )

  if (file.size <= 0) throw new Error('Empty file')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 8MB or smaller')

  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }
  if (
    ALLOWED_IMAGE_TYPES.size > 0 &&
    !ALLOWED_IMAGE_TYPES.has(contentType) &&
    contentType !== 'image/jpg'
  ) {
    throw new Error('Use JPEG, PNG, WebP, or GIF')
  }

  const ext = imageExt(contentType, file.name)
  const objectPath = `digital_products/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const token = randomUUID()

  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}
