import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import {
  MARKETPLACE_SERVICE_FEE_RATE,
  ORDER_ESCROW_COLLECTION,
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
  isBankTransferEscrow,
} from '@/lib/finance'
import { pawapayProcessingFee } from '@/lib/buyer-commission'

const PLATFORM_WALLET_NAME = 'Vero 360 Platform'
const PLATFORM_WALLET_DOC_ID = 'super_admin'
const EMBEDDED_TX_CAP = 25

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

/**
 * Ensures a single canonical platform wallet at wallets/super_admin,
 * merges any duplicate WLT* platform wallets into it, and credits any
 * released escrow fees that never landed.
 */
export async function backfillMissingPlatformFees(db: Firestore): Promise<{
  credited: number
  amount: number
  skipped: number
  mergedDuplicates: number
}> {
  const walletRef = db.collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_DOC_ID)
  const duplicatesSnap = await db
    .collection(WALLETS_COLLECTION)
    .where('userId', '==', PLATFORM_WALLET_USER_ID)
    .get()

  let mergedDuplicates = 0
  let mergedBalance = 0
  const duplicateIds: string[] = []

  for (const d of duplicatesSnap.docs) {
    if (d.id === PLATFORM_WALLET_DOC_ID) continue
    duplicateIds.push(d.id)
    mergedBalance += num(d.data().balance)
    mergedDuplicates += 1
  }

  const existing = await walletRef.get()
  if (!existing.exists) {
    await walletRef.set({
      walletId: PLATFORM_WALLET_DOC_ID,
      userId: PLATFORM_WALLET_USER_ID,
      merchantName: PLATFORM_WALLET_NAME,
      balance: mergedBalance,
      pendingBalance: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      transactions: [],
    })
  } else if (mergedBalance > 0) {
    await db.runTransaction(async txn => {
      const snap = await txn.get(walletRef)
      const data = (snap.data() || {}) as Record<string, unknown>
      txn.set(
        walletRef,
        {
          walletId: PLATFORM_WALLET_DOC_ID,
          userId: PLATFORM_WALLET_USER_ID,
          merchantName: PLATFORM_WALLET_NAME,
          balance: num(data.balance) + mergedBalance,
          pendingBalance: num(data.pendingBalance),
          updatedAt: FieldValue.serverTimestamp(),
          transactions: Array.isArray(data.transactions)
            ? (data.transactions as unknown[]).slice(-EMBEDDED_TX_CAP)
            : [],
        },
        { merge: true },
      )
    })
  } else {
    await walletRef.set(
      {
        walletId: PLATFORM_WALLET_DOC_ID,
        userId: PLATFORM_WALLET_USER_ID,
        merchantName: PLATFORM_WALLET_NAME,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  // Zero + retire duplicate platform wallets so cash-out / UI can't pick the wrong one.
  for (const id of duplicateIds) {
    await db.collection(WALLETS_COLLECTION).doc(id).set(
      {
        balance: 0,
        pendingBalance: 0,
        userId: `${PLATFORM_WALLET_USER_ID}_merged_${id}`,
        mergedInto: PLATFORM_WALLET_DOC_ID,
        updatedAt: FieldValue.serverTimestamp(),
        transactions: [],
      },
      { merge: true },
    )
  }

  const feeSnap = await db
    .collection(WALLET_TX_COLLECTION)
    .where('type', '==', 'service_fee')
    .limit(1000)
    .get()
    .catch(async () => db.collection(WALLET_TX_COLLECTION).limit(1000).get())

  const creditedRefs = new Set<string>()
  for (const d of feeSnap.docs) {
    const data = d.data() as Record<string, unknown>
    if (String(data.type || '').toLowerCase() !== 'service_fee') continue
    const uid = String(data.userId || '')
    const wid = String(data.walletId || '')
    const isPlatform =
      uid === PLATFORM_WALLET_USER_ID ||
      wid === PLATFORM_WALLET_DOC_ID ||
      duplicateIds.includes(wid) ||
      (!uid && !wid)
    if (!isPlatform) continue
    const ref = String(data.reference || '').trim()
    if (ref) creditedRefs.add(ref)
  }

  const walletData = (await walletRef.get()).data() as Record<string, unknown> | undefined
  const embedded = Array.isArray(walletData?.transactions)
    ? (walletData!.transactions as Record<string, unknown>[])
    : []
  for (const t of embedded) {
    if (String(t.type || '').toLowerCase() !== 'service_fee') continue
    const ref = String(t.reference || '').trim()
    if (ref) creditedRefs.add(ref)
  }

  const escrowSnap = await db.collection(ORDER_ESCROW_COLLECTION).get()
  let credited = 0
  let amount = 0
  let skipped = 0

  for (const doc of escrowSnap.docs) {
    const data = doc.data() as Record<string, unknown>
    const status = String(data.status || '').toLowerCase()
    if (status !== 'released' && status !== 'auto_released') {
      skipped += 1
      continue
    }

    // A cleared wallet removes the fee rows. Honor either flag so those fees
    // are not credited a second time on the next wallet load.
    if (data.platformFeeCredited === true || data.platformFeeCleared === true) {
      skipped += 1
      continue
    }

    if (isBankTransferEscrow(data)) {
      skipped += 1
      continue
    }

    let commission = num(data.serviceFeeAmount)
    if (!(commission > 0)) {
      const gross = num(data.grossAmount)
      const merchantAmount = num(data.merchantAmount)
      const rate =
        num(data.feeRate) > 0 ? num(data.feeRate) : MARKETPLACE_SERVICE_FEE_RATE
      if (gross > 0) commission = Math.round(gross * rate * 100) / 100
      else if (merchantAmount > 0 && rate > 0 && rate < 1) {
        commission = Math.round(((merchantAmount * rate) / (1 - rate)) * 100) / 100
      }
    }
    const buyerTotal =
      num(data.buyerPaysAmount) || num(data.merchantAmount) + commission
    const processing =
      num(data.processingFeeAmount) || pawapayProcessingFee(buyerTotal, commission)
    const veroShare = num(data.veroShareAmount)
    let fee =
      veroShare > 0 && num(data.processingFeeAmount) > 0
        ? veroShare
        : Math.max(0, commission - processing)

    const txRef = String(data.txRef || doc.id).trim()
    if (!(fee > 0)) {
      await doc.ref.set({ platformFeeCredited: true }, { merge: true })
      skipped += 1
      continue
    }

    if (data.platformFeeCredited === true && txRef && creditedRefs.has(txRef)) {
      skipped += 1
      continue
    }

    if (txRef && creditedRefs.has(txRef)) {
      await doc.ref.set(
        {
          platformFeeCredited: true,
          platformFeeCreditedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      skipped += 1
      continue
    }

    const serviceType = String(data.serviceType || 'marketplace').toLowerCase()
    const service =
      serviceType === 'accommodation' || serviceType === 'stay'
        ? 'stay'
        : serviceType === 'food'
          ? 'food'
          : 'marketplace'
    const transactionId = `TXN${Date.now()}${credited}`
    const now = Timestamp.now()
    const description =
      service === 'stay'
        ? `Stay buyer commission (${txRef})`
        : service === 'food'
          ? `Food buyer commission (${txRef})`
          : `Marketplace buyer commission (${txRef})`
    const txPayload: Record<string, unknown> = {
      transactionId,
      walletId: PLATFORM_WALLET_DOC_ID,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'service_fee',
      amount: fee,
      status: 'completed',
      description,
      reference: txRef,
      service,
      createdAt: now,
      updatedAt: now,
      backfilled: true,
    }

    await db.runTransaction(async txn => {
      const snap = await txn.get(walletRef)
      if (!snap.exists) throw new Error('Platform wallet missing')
      const w = snap.data() as Record<string, unknown>
      const list = Array.isArray(w.transactions)
        ? [...(w.transactions as Record<string, unknown>[])]
        : []
      list.push(txPayload)
      const capped = list.length > EMBEDDED_TX_CAP ? list.slice(-EMBEDDED_TX_CAP) : list
      txn.update(walletRef, {
        balance: num(w.balance) + fee,
        updatedAt: FieldValue.serverTimestamp(),
        transactions: capped,
      })
    })

    await db.collection(WALLET_TX_COLLECTION).doc(transactionId).set(txPayload)
    creditedRefs.add(txRef)
    credited += 1
    amount += fee

    const pawapayRef = `${txRef}-pawapay`
    if (processing > 0 && !creditedRefs.has(pawapayRef) && data.pawapayFeeCredited !== true) {
      const pawapayTxId = `TXN${Date.now()}${credited}p`
      await db.collection(WALLET_TX_COLLECTION).doc(pawapayTxId).set({
        transactionId: pawapayTxId,
        walletId: PLATFORM_WALLET_DOC_ID,
        userId: PLATFORM_WALLET_USER_ID,
        type: 'processing_fee',
        amount: processing,
        status: 'completed',
        description:
          service === 'stay'
            ? `Stay PawaPay processing (${txRef})`
            : service === 'food'
              ? `Food PawaPay processing (${txRef})`
              : `Marketplace PawaPay processing (${txRef})`,
        reference: pawapayRef,
        service: 'pawapay',
        createdAt: now,
        updatedAt: now,
        backfilled: true,
      })
      creditedRefs.add(pawapayRef)
    }

    await doc.ref.set(
      {
        platformFeeCredited: true,
        pawapayFeeCredited: processing > 0,
        platformFeeCreditedAt: FieldValue.serverTimestamp(),
        platformFeeBackfilled: true,
      },
      { merge: true },
    )
  }

  return { credited, amount, skipped, mergedDuplicates }
}
