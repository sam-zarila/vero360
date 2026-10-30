import { randomUUID } from 'crypto'
import { getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

export type DigitalPayoutKycKind = 'cny' | 'usdt'

export type DigitalPayoutKyc = {
  kind: DigitalPayoutKycKind | string
  alipayWechatCodeUrl: string
  idInHandUrl: string
  faceUrl: string
  binanceId: string
  binanceAddress: string
  binanceCodeUrl: string
  uploadedAt: string | null
}

export type DigitalOrderFulfillment = {
  cardDetails: string
  joiningLink: string
  notes: string
  sentAt: string | null
  sentVia: string[]
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export function detectDigitalPayoutKycKind(input: {
  category?: string | null
  key?: string | null
  name?: string | null
  unitLabel?: string | null
  brandTag?: string | null
  subtitle?: string | null
}): DigitalPayoutKycKind | null {
  const blob = [
    input.key,
    input.name,
    input.subtitle,
    input.brandTag,
    input.unitLabel,
    input.category,
  ]
    .join(' ')
    .toLowerCase()
  const unit = String(input.unitLabel || '')
    .trim()
    .toLowerCase()
  const isCrypto = String(input.category || '')
    .trim()
    .toLowerCase() === 'crypto'

  const isUsdt =
    blob.includes('usdt') ||
    blob.includes('tether') ||
    blob.includes('binance') ||
    unit === 'usdt'
  if (isUsdt) return 'usdt'

  const mentionsChina =
    blob.includes('cny') ||
    blob.includes('rmb') ||
    blob.includes('yuan') ||
    blob.includes('alipay') ||
    blob.includes('wechat') ||
    blob.includes('weixin') ||
    unit === 'cny' ||
    unit === 'rmb'
  const isTt = /\btt\b/.test(blob) || blob.includes('telegraphic')
  if (mentionsChina || (isTt && (mentionsChina || blob.includes('china') || isCrypto))) {
    return 'cny'
  }
  if (isCrypto && (unit === 'usd' || blob.includes('usd'))) return 'cny'
  if (isCrypto) return 'usdt'
  return null
}

export function emptyPayoutKyc(): DigitalPayoutKyc {
  return {
    kind: '',
    alipayWechatCodeUrl: '',
    idInHandUrl: '',
    faceUrl: '',
    binanceId: '',
    binanceAddress: '',
    binanceCodeUrl: '',
    uploadedAt: null,
  }
}

export function parsePayoutKyc(raw: unknown): DigitalPayoutKyc | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const kind = String(d.kind || '').trim().toLowerCase()
  const item: DigitalPayoutKyc = {
    kind,
    alipayWechatCodeUrl: String(d.alipayWechatCodeUrl || '').trim(),
    idInHandUrl: String(d.idInHandUrl || '').trim(),
    faceUrl: String(d.faceUrl || '').trim(),
    binanceId: String(d.binanceId || '').trim(),
    binanceAddress: String(d.binanceAddress || '').trim(),
    binanceCodeUrl: String(d.binanceCodeUrl || '').trim(),
    uploadedAt: typeof d.uploadedAt === 'string' ? d.uploadedAt : null,
  }
  const hasAny =
    item.alipayWechatCodeUrl ||
    item.idInHandUrl ||
    item.faceUrl ||
    item.binanceId ||
    item.binanceAddress ||
    item.binanceCodeUrl
  return hasAny || kind ? item : null
}

export function payoutKycHasContent(kyc: DigitalPayoutKyc | null | undefined): boolean {
  if (!kyc) return false
  return Boolean(
    kyc.alipayWechatCodeUrl ||
      kyc.idInHandUrl ||
      kyc.faceUrl ||
      kyc.binanceId ||
      kyc.binanceAddress ||
      kyc.binanceCodeUrl,
  )
}

export function assertPayoutKycComplete(
  kind: DigitalPayoutKycKind,
  kyc: Partial<DigitalPayoutKyc> | null | undefined,
): void {
  if (kind === 'cny') {
    if (!kyc?.alipayWechatCodeUrl || !kyc.idInHandUrl || !kyc.faceUrl) {
      throw new Error(
        'Upload your Alipay or WeChat code, a photo of your ID held in your hands, and a photo of your face.',
      )
    }
    return
  }
  if (!kyc?.binanceCodeUrl || !kyc.idInHandUrl || !kyc.faceUrl) {
    throw new Error(
      'Upload your Binance code, a photo of your ID held in your hands, and a photo of your face.',
    )
  }
}

function imageExt(contentType: string, fileName: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase()
  if (fromName === 'png' || fromName === 'webp' || fromName === 'jpg' || fromName === 'jpeg') {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

export async function uploadDigitalKycImage(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('Empty file')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 4MB or smaller')
  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!contentType.startsWith('image/')) throw new Error('Only image files are allowed')
  if (!ALLOWED_IMAGE_TYPES.has(contentType) && contentType !== 'image/jpg') {
    throw new Error('Use JPEG, PNG, or WebP')
  }

  const ext = imageExt(contentType, file.name)
  const objectPath = `digital_kyc/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const token = randomUUID()

  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

export function isAppBuyerUid(uid: string, isGuest?: boolean): boolean {
  if (isGuest) return false
  const v = uid.trim()
  if (!v) return false
  if (v.startsWith('web:') || v.startsWith('guest:')) return false
  return v.length >= 20
}
