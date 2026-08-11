import { formatDateTime } from '@/lib/vero-api'

export const ADMINS_COLLECTION = 'admins'

export type AdminRole = 'super_admin' | 'admin'
export type AdminStatus = 'active' | 'suspended'

export type PanelAdmin = {
  id: string
  email: string
  displayName: string
  role: AdminRole
  status: AdminStatus
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  lastLoginAt: string | null
}

export type CreateAdminInput = {
  email: string
  password: string
  displayName?: string
  role?: AdminRole
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

export function normalizeAdminRole(raw: unknown): AdminRole {
  const v = str(raw).toLowerCase().replace(/[\s-]+/g, '_')
  if (v === 'super_admin' || v === 'superadmin' || v === 'super') return 'super_admin'
  return 'admin'
}

export function normalizeAdminStatus(raw: unknown): AdminStatus {
  const v = str(raw).toLowerCase()
  if (v === 'suspended' || v === 'disabled' || v === 'inactive') return 'suspended'
  return 'active'
}

export function parsePanelAdmin(
  id: string,
  data: Record<string, unknown>,
): PanelAdmin {
  return {
    id,
    email: str(data.email).toLowerCase(),
    displayName: str(data.displayName) || str(data.name) || str(data.email) || 'Admin',
    role: normalizeAdminRole(data.role ?? data.panelRole),
    status: normalizeAdminStatus(data.status ?? data.accountStatus),
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
    createdBy: str(data.createdBy) || null,
    lastLoginAt: ts(data.lastLoginAt),
  }
}

export function adminRoleLabel(role: AdminRole) {
  return role === 'super_admin' ? 'Super admin' : 'Admin'
}

export function adminRoleTone(role: AdminRole) {
  return role === 'super_admin'
    ? { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' }
    : { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
}

export function adminStatusTone(status: AdminStatus) {
  return status === 'active'
    ? { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: 'Active' }
    : { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA', label: 'Suspended' }
}

export function countAdmins(admins: PanelAdmin[]) {
  return {
    all: admins.length,
    super_admin: admins.filter(a => a.role === 'super_admin').length,
    admin: admins.filter(a => a.role === 'admin').length,
    active: admins.filter(a => a.status === 'active').length,
    suspended: admins.filter(a => a.status === 'suspended').length,
  }
}

/** Emails that are always treated as super admin (bootstrap / break-glass). */
export function configuredSuperAdminEmails(): string[] {
  const raw =
    process.env.VERO_SUPER_ADMIN_EMAILS ||
    process.env.SUPER_ADMIN_EMAILS ||
    process.env.VERO_SUPER_ADMIN_EMAIL ||
    ''
  return raw
    .split(/[,;\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isConfiguredSuperAdminEmail(email: string) {
  const e = email.trim().toLowerCase()
  if (!e) return false
  return configuredSuperAdminEmails().includes(e)
}

export { formatDateTime }
