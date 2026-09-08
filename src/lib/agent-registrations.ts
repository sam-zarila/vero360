/** Agent onboarding registrations — Firestore `agent_registrations`. */

import type { UserRole } from '@/lib/users'

export const AGENT_REGISTRATIONS_COLLECTION = 'agent_registrations'

export type AgentGeo = {
  lat: number | null
  lng: number | null
  label: string
}

export type AgentRegistration = {
  id: string
  userId: string | null
  name: string
  email: string
  phone: string
  role: UserRole
  businessName: string | null
  businessAddress: string | null
  merchantService: string | null
  isVerified: boolean
  geo: AgentGeo
  registeredAt: string | null
  agentUid: string
  agentName: string
  agentEmail: string
  createdAt: string | null
  updatedAt: string | null
}

export const MERCHANT_SERVICES = [
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'food', label: 'Food & Restaurants' },
  { key: 'accommodation', label: 'Accommodation' },
] as const

export type MerchantServiceKey = (typeof MERCHANT_SERVICES)[number]['key']

export type CreateAgentRegistrationInput = {
  name: string
  /** Real email — optional if phone is provided (phone-only uses synthetic auth email like the app). */
  email?: string | null
  phone?: string | null
  role: UserRole | string
  /** Required unless generateTempPassword is true. */
  password?: string | null
  /** When true, server creates a one-time temp password (user not present). */
  generateTempPassword?: boolean
  /** Ticket from /auth/otp/verify — required before account create. */
  verificationTicket?: string | null
  /** email | phone — channel used for OTP. */
  preferredVerification?: string | null
  businessName?: string | null
  businessAddress?: string | null
  merchantService?: string | null
  isVerified?: boolean
  geo?: {
    lat?: number | null
    lng?: number | null
    label?: string | null
  } | null
}

export type AgentRegistrationCounts = {
  all: number
  customer: number
  merchant: number
  driver: number
  verified: number
  unverified: number
}

export function formatPhoneE164(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  if (digits.startsWith('265') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+265${digits.slice(1)}`
  if (trimmed.startsWith('+')) return trimmed
  return `+${digits}`
}

export function syntheticEmailForPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@phone.vero360.app`
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function ts(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeAgentUserRole(raw: unknown): UserRole {
  const v = str(raw).toLowerCase()
  if (v === 'merchant' || v === 'business') return 'merchant'
  if (v === 'driver' || v === 'taxi') return 'driver'
  return 'customer'
}

export function parseAgentGeo(raw: unknown): AgentGeo {
  if (!raw || typeof raw !== 'object') {
    return { lat: null, lng: null, label: '' }
  }
  const g = raw as Record<string, unknown>
  return {
    lat: num(g.lat ?? g.latitude),
    lng: num(g.lng ?? g.longitude),
    label: str(g.label ?? g.address ?? g.place),
  }
}

export function parseAgentRegistration(
  id: string,
  data: Record<string, unknown>,
): AgentRegistration {
  return {
    id,
    userId: str(data.userId) || null,
    name: str(data.name) || str(data.displayName) || '—',
    email: str(data.email).toLowerCase(),
    phone: str(data.phone) || str(data.phoneNumber),
    role: normalizeAgentUserRole(data.role),
    businessName: str(data.businessName) || null,
    businessAddress: str(data.businessAddress) || null,
    merchantService: str(data.merchantService) || str(data.serviceType) || null,
    isVerified: data.isVerified === true || data.verified === true,
    geo: parseAgentGeo(data.geo),
    registeredAt: ts(data.registeredAt) || ts(data.createdAt),
    agentUid: str(data.agentUid) || str(data.registeredByAgentId),
    agentName: str(data.agentName) || str(data.registeredByAgentName),
    agentEmail: str(data.agentEmail) || str(data.registeredByAgentEmail),
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  }
}

export function countAgentRegistrations(items: AgentRegistration[]): AgentRegistrationCounts {
  const counts: AgentRegistrationCounts = {
    all: items.length,
    customer: 0,
    merchant: 0,
    driver: 0,
    verified: 0,
    unverified: 0,
  }
  for (const item of items) {
    if (item.role === 'customer') counts.customer += 1
    else if (item.role === 'merchant') counts.merchant += 1
    else if (item.role === 'driver') counts.driver += 1
    if (item.isVerified) counts.verified += 1
    else counts.unverified += 1
  }
  return counts
}

export function formatAgentGeo(geo: AgentGeo): string {
  if (geo.label) return geo.label
  if (geo.lat != null && geo.lng != null) {
    return `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`
  }
  return '—'
}

export function formatAgentRegisteredDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
