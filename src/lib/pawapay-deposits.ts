import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { readPawaPayDeposit } from '@/lib/pawapay'

export const PAWAPAY_DEPOSITS_COLLECTION = 'pawapay_deposits'

export type StoredPawaPayDeposit = {
  depositId: string
  userId: string
  amount: number
  phone: string
  provider: string
  reference: string
  orderId: string
  kind: string
  status: string
  failure: string
}

function asDeposit(
  id: string,
  data: Record<string, unknown>,
): StoredPawaPayDeposit {
  return {
    depositId: id,
    userId: String(data.userId || ''),
    amount: Number(data.amount || 0) || 0,
    phone: String(data.phone || ''),
    provider: String(data.provider || ''),
    reference: String(data.reference || ''),
    orderId: String(data.orderId || ''),
    kind: String(data.kind || ''),
    status: String(data.status || 'pending').toLowerCase(),
    failure: String(data.failure || ''),
  }
}

export async function savePawaPayDeposit(input: {
  depositId: string
  userId: string
  amount: number
  phone: string
  provider: string
  reference: string
  orderId: string
  kind: string
}): Promise<void> {
  await getAdminDb()
    .collection(PAWAPAY_DEPOSITS_COLLECTION)
    .doc(input.depositId)
    .set({
      ...input,
      status: 'pending',
      failure: null,
      createdAt: FieldValue.serverTimestamp(),
    })
}

export async function getStoredDeposit(
  depositId: string,
): Promise<StoredPawaPayDeposit | null> {
  const snap = await getAdminDb()
    .collection(PAWAPAY_DEPOSITS_COLLECTION)
    .doc(depositId)
    .get()
  if (!snap.exists) return null
  return asDeposit(snap.id, snap.data() || {})
}

async function findByReference(reference: string): Promise<StoredPawaPayDeposit[]> {
  const snap = await getAdminDb()
    .collection(PAWAPAY_DEPOSITS_COLLECTION)
    .where('reference', '==', reference)
    .limit(5)
    .get()
  return snap.docs.map(doc => asDeposit(doc.id, doc.data() || {}))
}

/** Ask PawaPay for the latest status and write it onto the deposit doc. */
export async function refreshStoredDeposit(
  depositId: string,
): Promise<StoredPawaPayDeposit | null> {
  const current = await getStoredDeposit(depositId)
  if (!current) return null
  if (current.status === 'completed' || current.status === 'failed') return current

  const live = await readPawaPayDeposit(depositId)
  if (live.status === 'pending') return current

  await getAdminDb()
    .collection(PAWAPAY_DEPOSITS_COLLECTION)
    .doc(depositId)
    .set(
      {
        status: live.status,
        failure: live.status === 'failed' ? live.failure : null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  return {
    ...current,
    status: live.status,
    failure: live.failure,
  }
}

/**
 * A payment counts only when PawaPay marked that reference completed.
 * Pending deposits are refreshed once before the answer is returned.
 */
export async function confirmPawaPayReference(
  reference: string,
  expectedAmount = 0,
): Promise<{ paid: boolean; status: string; depositId: string; failure: string }> {
  const clean = reference.trim()
  if (!clean) return { paid: false, status: 'missing', depositId: '', failure: '' }

  const rows = await findByReference(clean)
  for (const row of rows) {
    const fresh =
      row.status === 'completed' || row.status === 'failed'
        ? row
        : (await refreshStoredDeposit(row.depositId)) || row
    if (fresh.status !== 'completed') continue
    if (expectedAmount > 0 && Math.abs(fresh.amount - expectedAmount) > 1) {
      return {
        paid: false,
        status: 'amount_mismatch',
        depositId: fresh.depositId,
        failure: 'The paid amount does not match this order.',
      }
    }
    return {
      paid: true,
      status: 'completed',
      depositId: fresh.depositId,
      failure: '',
    }
  }

  const pending = rows.find(row => row.status !== 'failed')
  return {
    paid: false,
    status: pending?.status || 'pending',
    depositId: pending?.depositId || rows[0]?.depositId || '',
    failure: rows.find(row => row.failure)?.failure || '',
  }
}
