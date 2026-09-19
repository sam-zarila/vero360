import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const RIDE_SHARE_CONFIG_DOC = 'app_config/ride_share'

export type RideShareConfig = {
  frontDeskWhatsApp: string
  frontDeskPhone: string
  updatedAt: string | null
  updatedByEmail: string | null
}

export const DEFAULT_RIDE_SHARE_CONFIG: RideShareConfig = {
  frontDeskWhatsApp: '+265992695612',
  frontDeskPhone: '+265992695612',
  updatedAt: null,
  updatedByEmail: null,
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

/** Store as +digits when possible so wa.me / tel: links stay valid. */
export function normalizePhone(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim()
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) return fallback
  return `+${digits}`
}

export async function getRideShareConfig(): Promise<RideShareConfig> {
  const snap = await getAdminDb().doc(RIDE_SHARE_CONFIG_DOC).get()
  if (!snap.exists) return { ...DEFAULT_RIDE_SHARE_CONFIG }
  const d = snap.data() || {}
  const wa = normalizePhone(d.frontDeskWhatsApp, DEFAULT_RIDE_SHARE_CONFIG.frontDeskWhatsApp)
  return {
    frontDeskWhatsApp: wa,
    frontDeskPhone: normalizePhone(d.frontDeskPhone, wa),
    updatedAt: tsToIso(d.updatedAt),
    updatedByEmail: d.updatedByEmail ? String(d.updatedByEmail) : null,
  }
}

function requirePhone(raw: unknown, label: string): string {
  const value = String(raw ?? '').trim()
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) {
    throw new Error(
      `Enter a valid ${label} with country code, e.g. +265992695612`,
    )
  }
  return `+${digits}`
}

export async function saveRideShareConfig(input: {
  frontDeskWhatsApp?: string
  frontDeskPhone?: string
  updatedByEmail?: string
}): Promise<RideShareConfig> {
  const wa = requirePhone(input.frontDeskWhatsApp, 'WhatsApp number')
  const phoneInput = (input.frontDeskPhone ?? '').trim()
  const phone = phoneInput ? requirePhone(phoneInput, 'call number') : wa

  await getAdminDb().doc(RIDE_SHARE_CONFIG_DOC).set(
    {
      frontDeskWhatsApp: wa,
      frontDeskPhone: phone,
      updatedByEmail: (input.updatedByEmail || '').trim() || null,
      updatedAt: FieldValue.serverTimestamp(),
      source: 'admin_panel',
    },
    { merge: true },
  )
  return getRideShareConfig()
}
