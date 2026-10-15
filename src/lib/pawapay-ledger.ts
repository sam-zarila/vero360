import 'server-only'

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { PLATFORM_WALLET_USER_ID, WALLETS_COLLECTION, WALLET_TX_COLLECTION } from '@/lib/finance'

export async function reservePawaPayPayout(input: {
  walletId: string
  amount: number
  payoutId: string
  description: string
  phone: string
  provider: string
}): Promise<{ transactionId: string; balance: number }> {
  const db = getAdminDb()
  const walletRef = db.collection(WALLETS_COLLECTION).doc(input.walletId)
  const transactionId = `TXN${Date.now()}`
  const now = Timestamp.now()
  let balance = 0

  await db.runTransaction(async txn => {
    const snap = await txn.get(walletRef)
    if (!snap.exists) throw new Error('Wallet not found')
    const data = snap.data() as Record<string, unknown>
    const current = Number(data.balance) || 0
    if (current < input.amount) throw new Error('Insufficient balance')
    balance = current - input.amount
    const txPayload = {
      transactionId,
      walletId: input.walletId,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'payout',
      amount: input.amount,
      status: 'pending',
      description: input.description,
      reference: input.payoutId,
      payoutMethod: 'mobile_money',
      payoutProvider: 'pawapay',
      recipientPhone: input.phone,
      provider: input.provider,
      createdAt: now,
      updatedAt: now,
    }
    const list = Array.isArray(data.transactions)
      ? [...(data.transactions as Record<string, unknown>[])]
      : []
    list.push(txPayload)
    const capped = list.length > 25 ? list.slice(-25) : list
    txn.update(walletRef, {
      balance,
      pendingBalance: (Number(data.pendingBalance) || 0) + input.amount,
      updatedAt: FieldValue.serverTimestamp(),
      transactions: capped,
    })
    txn.set(db.collection(WALLET_TX_COLLECTION).doc(transactionId), txPayload)
    txn.set(db.collection('pawapay_payouts').doc(input.payoutId), {
      payoutId: input.payoutId,
      transactionId,
      walletId: input.walletId,
      userId: PLATFORM_WALLET_USER_ID,
      amount: input.amount,
      phone: input.phone,
      provider: input.provider,
      status: 'pending',
      createdAt: now,
    })
  })

  return { transactionId, balance }
}

export async function releasePawaPayReserve(
  payoutId: string,
  status: 'failed',
  failure: string,
): Promise<void> {
  const db = getAdminDb()
  const payoutRef = db.collection('pawapay_payouts').doc(payoutId)
  await db.runTransaction(async txn => {
    const payoutSnap = await txn.get(payoutRef)
    if (!payoutSnap.exists) return
    const payout = payoutSnap.data() as Record<string, unknown>
    if (payout.status === 'completed' || payout.status === 'failed') return
    const amount = Number(payout.amount) || 0
    const walletRef = db.collection(WALLETS_COLLECTION).doc(String(payout.walletId || ''))
    const walletSnap = await txn.get(walletRef)
    if (!walletSnap.exists) return
    const wallet = walletSnap.data() as Record<string, unknown>
    const pending = Number(wallet.pendingBalance) || 0
    const patch: Record<string, unknown> = {
      balance: (Number(wallet.balance) || 0) + (status === 'failed' ? amount : 0),
      pendingBalance: Math.max(0, pending - amount),
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (Array.isArray(wallet.transactions)) {
      patch.transactions = (wallet.transactions as Record<string, unknown>[]).map(row => {
        const same =
          String(row.reference || '') === payoutId ||
          String(row.transactionId || '') === String(payout.transactionId || '')
        if (!same) return row
        return {
          ...row,
          status: 'failed',
          failureReason: failure,
          updatedAt: Timestamp.now(),
        }
      })
    }
    txn.update(walletRef, patch)
    txn.set(
      payoutRef,
      { status, failure, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    if (payout.transactionId) {
      txn.set(
        db.collection(WALLET_TX_COLLECTION).doc(String(payout.transactionId)),
        {
          status: 'failed',
          failureReason: failure,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }
  })
}
