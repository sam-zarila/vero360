import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const BANK_TRANSFER_CONFIG_DOC = 'app_config/bank_transfer'

export type BankTransferConfig = {
  enabled: boolean
  bankName: string
  accountName: string
  accountNumber: string
  branch: string
  updatedAt: string | null
  updatedByEmail: string | null
}

export const DEFAULT_BANK_TRANSFER_CONFIG: BankTransferConfig = {
  enabled: true,
  bankName: 'National Bank of Malawi',
  accountName: 'VERO360 LIMITED',
  accountNumber: '1015027734',
  branch: 'City Centre',
  updatedAt: null,
  updatedByEmail: null,
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

export function parseBankTransferConfig(
  data: Record<string, unknown> | undefined | null,
): BankTransferConfig {
  const d = data || {}
  return {
    enabled: d.enabled !== false,
    bankName: str(d.bankName) || DEFAULT_BANK_TRANSFER_CONFIG.bankName,
    accountName: str(d.accountName) || DEFAULT_BANK_TRANSFER_CONFIG.accountName,
    accountNumber:
      str(d.accountNumber) || DEFAULT_BANK_TRANSFER_CONFIG.accountNumber,
    branch: str(d.branch) || DEFAULT_BANK_TRANSFER_CONFIG.branch,
    updatedAt: tsToIso(d.updatedAt),
    updatedByEmail: str(d.updatedByEmail) || null,
  }
}

export function publicBankTransferPayload(config: BankTransferConfig) {
  if (!config.enabled) return { enabled: false as const }
  return {
    enabled: true as const,
    bankName: config.bankName,
    accountName: config.accountName,
    accountNumber: config.accountNumber,
    branch: config.branch,
  }
}

export async function getBankTransferConfig(): Promise<BankTransferConfig> {
  const snap = await getAdminDb().doc(BANK_TRANSFER_CONFIG_DOC).get()
  if (!snap.exists) return { ...DEFAULT_BANK_TRANSFER_CONFIG }
  return parseBankTransferConfig(snap.data() as Record<string, unknown>)
}

export async function saveBankTransferConfig(input: {
  enabled?: boolean
  bankName?: string
  accountName?: string
  accountNumber?: string
  branch?: string
  updatedByEmail?: string
}): Promise<BankTransferConfig> {
  const current = await getBankTransferConfig()
  const next = {
    enabled: input.enabled !== undefined ? !!input.enabled : current.enabled,
    bankName: str(input.bankName) || current.bankName,
    accountName: str(input.accountName) || current.accountName,
    accountNumber: str(input.accountNumber) || current.accountNumber,
    branch: str(input.branch) || current.branch,
    updatedByEmail: str(input.updatedByEmail) || null,
    updatedAt: FieldValue.serverTimestamp(),
    source: 'admin_panel',
  }
  await getAdminDb().doc(BANK_TRANSFER_CONFIG_DOC).set(next, { merge: true })
  return getBankTransferConfig()
}
