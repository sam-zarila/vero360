import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import {
  ORDER_ESCROW_COLLECTION,
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
} from '@/lib/finance'

const PLATFORM_WALLET_DOC_ID = 'super_admin'
const BATCH = 400

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

async function deleteWhere(
  db: Firestore,
  field: string,
  value: string,
  seen: Set<string>,
): Promise<number> {
  let removed = 0
  for (;;) {
    const snap = await db
      .collection(WALLET_TX_COLLECTION)
      .where(field, '==', value)
      .limit(BATCH)
      .get()
    if (snap.empty) break
    const batch = db.batch()
    let n = 0
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      batch.delete(doc.ref)
      n += 1
    }
    if (n > 0) await batch.commit()
    removed += n
    if (snap.size < BATCH || n === 0) break
  }
  return removed
}

/**
 * Zero the Vero platform wallet and its ledger history.
 * Released escrows stay marked credited so the fee backfill does not
 * refill this balance. Held escrow is left alone and still credits on release.
 */
export async function clearPlatformWallet(db: Firestore): Promise<{
  wallets: number
  balanceCleared: number
  pendingCleared: number
  transactionsDeleted: number
  escrowsMarked: number
}> {
  const duplicatesSnap = await db
    .collection(WALLETS_COLLECTION)
    .where('userId', '==', PLATFORM_WALLET_USER_ID)
    .get()

  const walletIds = new Set<string>([PLATFORM_WALLET_DOC_ID])
  for (const doc of duplicatesSnap.docs) walletIds.add(doc.id)

  let balanceCleared = 0
  let pendingCleared = 0
  let wallets = 0

  for (const id of walletIds) {
    const ref = db.collection(WALLETS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists && id !== PLATFORM_WALLET_DOC_ID) continue
    const data = (snap.data() || {}) as Record<string, unknown>
    balanceCleared += num(data.balance)
    pendingCleared += num(data.pendingBalance)
    wallets += 1
    await ref.set(
      {
        walletId: id,
        userId: PLATFORM_WALLET_USER_ID,
        merchantName: 'Vero 360 Platform',
        balance: 0,
        pendingBalance: 0,
        transactions: [],
        clearedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    )
  }

  const seen = new Set<string>()
  let transactionsDeleted = await deleteWhere(
    db,
    'userId',
    PLATFORM_WALLET_USER_ID,
    seen,
  )
  for (const id of walletIds) {
    transactionsDeleted += await deleteWhere(db, 'walletId', id, seen)
  }

  let escrowsMarked = 0
  const escrowSnap = await db.collection(ORDER_ESCROW_COLLECTION).get()
  let batch = db.batch()
  let pending = 0
  for (const doc of escrowSnap.docs) {
    const data = doc.data() as Record<string, unknown>
    const status = String(data.status || '').toLowerCase()
    if (status !== 'released' && status !== 'auto_released') continue
    if (data.platformFeeCredited === true) continue
    batch.set(
      doc.ref,
      {
        platformFeeCredited: true,
        platformFeeCleared: true,
        platformFeeCreditedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    pending += 1
    escrowsMarked += 1
    if (pending >= BATCH) {
      await batch.commit()
      batch = db.batch()
      pending = 0
    }
  }
  if (pending > 0) await batch.commit()

  return {
    wallets,
    balanceCleared,
    pendingCleared,
    transactionsDeleted,
    escrowsMarked,
  }
}
