import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const VERO_REWARDS_CONFIG_DOC = 'app_config/vero_rewards'

export type VeroRewardsConfig = {
  /** When false, users cannot cash out coins to wallet. */
  cashOutEnabled: boolean
  /** When false, spins / visit awards pause (optional hard stop). */
  earningEnabled: boolean
  updatedAt: string | null
  updatedByEmail: string | null
  note: string | null
}

export const DEFAULT_VERO_REWARDS_CONFIG: VeroRewardsConfig = {
  cashOutEnabled: true,
  earningEnabled: true,
  updatedAt: null,
  updatedByEmail: null,
  note: null,
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

export async function getVeroRewardsConfig(): Promise<VeroRewardsConfig> {
  const snap = await getAdminDb().doc(VERO_REWARDS_CONFIG_DOC).get()
  if (!snap.exists) return { ...DEFAULT_VERO_REWARDS_CONFIG }
  const d = snap.data() || {}
  return {
    cashOutEnabled: d.cashOutEnabled !== false,
    earningEnabled: d.earningEnabled !== false,
    updatedAt: tsToIso(d.updatedAt),
    updatedByEmail: d.updatedByEmail ? String(d.updatedByEmail) : null,
    note: d.note ? String(d.note) : null,
  }
}

export async function saveVeroRewardsConfig(input: {
  cashOutEnabled?: boolean
  earningEnabled?: boolean
  note?: string | null
  updatedByEmail?: string
}): Promise<VeroRewardsConfig> {
  const current = await getVeroRewardsConfig()
  const next = {
    cashOutEnabled:
      input.cashOutEnabled !== undefined
        ? !!input.cashOutEnabled
        : current.cashOutEnabled,
    earningEnabled:
      input.earningEnabled !== undefined
        ? !!input.earningEnabled
        : current.earningEnabled,
    note:
      input.note !== undefined
        ? String(input.note || '').trim() || null
        : current.note,
    updatedByEmail: (input.updatedByEmail || '').trim() || null,
    updatedAt: FieldValue.serverTimestamp(),
    source: 'admin_panel',
  }
  await getAdminDb().doc(VERO_REWARDS_CONFIG_DOC).set(next, { merge: true })
  return getVeroRewardsConfig()
}
