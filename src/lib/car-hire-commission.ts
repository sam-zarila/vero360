import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const CAR_HIRE_COMMISSION_DOC = 'platform_config/car_hire'
export const DEFAULT_CAR_HIRE_COMMISSION_PERCENT = 8

export type CarHireCommissionConfig = {
  /** Decimal rate stored on escrow rows, e.g. 0.08 */
  rate: number
  /** Percent shown in admin, e.g. 8 */
  ratePercent: number
  updatedAt: string | null
  updatedByEmail: string | null
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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CAR_HIRE_COMMISSION_PERCENT
  return Math.min(50, Math.max(0, Math.round(value * 100) / 100))
}

export async function getCarHireCommissionConfig(): Promise<CarHireCommissionConfig> {
  const snap = await getAdminDb().doc(CAR_HIRE_COMMISSION_DOC).get()
  if (!snap.exists) {
    return {
      rate: DEFAULT_CAR_HIRE_COMMISSION_PERCENT / 100,
      ratePercent: DEFAULT_CAR_HIRE_COMMISSION_PERCENT,
      updatedAt: null,
      updatedByEmail: null,
    }
  }
  const d = snap.data() || {}
  const stored = Number(d.rate)
  const percent = Number.isFinite(Number(d.ratePercent))
    ? Number(d.ratePercent)
    : Number.isFinite(stored)
      ? stored > 1
        ? stored
        : stored * 100
      : DEFAULT_CAR_HIRE_COMMISSION_PERCENT
  const ratePercent = clampPercent(percent)
  return {
    rate: ratePercent / 100,
    ratePercent,
    updatedAt: tsToIso(d.updatedAt),
    updatedByEmail: d.updatedByEmail ? String(d.updatedByEmail) : null,
  }
}

export async function saveCarHireCommissionConfig(input: {
  ratePercent: number
  updatedByEmail?: string
}): Promise<CarHireCommissionConfig> {
  const ratePercent = clampPercent(input.ratePercent)
  await getAdminDb()
    .doc(CAR_HIRE_COMMISSION_DOC)
    .set(
      {
        rate: ratePercent / 100,
        ratePercent,
        updatedByEmail: (input.updatedByEmail || '').trim() || null,
        updatedAt: FieldValue.serverTimestamp(),
        source: 'admin_panel',
      },
      { merge: true },
    )
  return getCarHireCommissionConfig()
}
