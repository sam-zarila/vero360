import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  ORDER_ESCROW_COLLECTION,
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
  PLATFORM_SERVICES,
  isPayoutTx,
  parseEscrow,
  parseWallet,
  parseWalletTx,
  escrowPawapayShare,
  escrowVeroShare,
  platformServiceLabel,
  platformServiceOf,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'
import { backfillMissingPlatformFees } from '@/lib/platform-fee-backfill'
import { summarizePawaPayFees } from '@/lib/pawapay-fees'

function mergeTx(into: WalletTxRow[], row: WalletTxRow) {
  if (!into.some(t => t.transactionId === row.transactionId)) {
    into.push(row)
  }
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const db = getAdminDb()

    // Repair released holds that never credited the 10% platform fee.
    let backfill = { credited: 0, amount: 0, skipped: 0, mergedDuplicates: 0 }
    try {
      backfill = await backfillMissingPlatformFees(db)
    } catch (err) {
      console.warn('Platform fee backfill skipped:', err)
    }

    const [platformWalletSnap, feeSnap, payoutSnap, processingSnap, escrowSnap] = await Promise.all([
      db.collection(WALLETS_COLLECTION).doc('super_admin').get(),
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'service_fee')
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get()
        .catch(() =>
          db
            .collection(WALLET_TX_COLLECTION)
            .where('type', '==', 'service_fee')
            .limit(500)
            .get()
            .catch(() => db.collection(WALLET_TX_COLLECTION).limit(500).get()),
        ),
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'payout')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
        .catch(() =>
          db
            .collection(WALLET_TX_COLLECTION)
            .where('type', '==', 'payout')
            .limit(200)
            .get()
            .catch(() => null),
        ),
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'processing_fee')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()
        .catch(() =>
          db
            .collection(WALLET_TX_COLLECTION)
            .where('type', '==', 'processing_fee')
            .limit(200)
            .get()
            .catch(() => null),
        ),
      db.collection(ORDER_ESCROW_COLLECTION).get(),
    ])

    let walletsSnapDocs = platformWalletSnap.exists
      ? [platformWalletSnap]
      : (
          await db
            .collection(WALLETS_COLLECTION)
            .where('userId', '==', PLATFORM_WALLET_USER_ID)
            .limit(5)
            .get()
        ).docs

    let wallet: WalletRow | null = walletsSnapDocs[0]
      ? parseWallet(
          walletsSnapDocs[0].id,
          walletsSnapDocs[0].data() as Record<string, unknown>,
        )
      : null

    const walletById = new Map<string, WalletRow>()
    if (wallet) walletById.set(wallet.walletId, wallet)

    const belongsToPlatform = (row: WalletTxRow) => {
      if (row.userId === PLATFORM_WALLET_USER_ID) return true
      if (wallet && row.walletId && row.walletId === wallet.walletId) return true
      if (row.type.toLowerCase() === 'service_fee' && !row.walletId && !row.userId) {
        return true
      }
      if (row.type.toLowerCase() === 'processing_fee') return true
      return false
    }

    const transactions: WalletTxRow[] = []
    const ingestDocs = (
      docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>,
    ) => {
      for (const d of docs) {
        const row = parseWalletTx(d.id, d.data() as Record<string, unknown>, walletById)
        const type = row.type.toLowerCase()
        if (type !== 'service_fee' && type !== 'processing_fee' && !isPayoutTx(row)) continue
        if (!belongsToPlatform(row)) continue
        mergeTx(transactions, row)
      }
    }
    ingestDocs(feeSnap.docs)
    if (payoutSnap) ingestDocs(payoutSnap.docs)
    if (processingSnap) ingestDocs(processingSnap.docs)

    if (wallet) {
      const data = walletsSnapDocs[0].data() as Record<string, unknown>
      const list = data.transactions
      if (Array.isArray(list)) {
        for (const raw of list) {
          if (!raw || typeof raw !== 'object') continue
          const obj = raw as Record<string, unknown>
          const type = String(obj.type || '').toLowerCase()
          if (
            type !== 'service_fee' &&
            type !== 'processing_fee' &&
            type !== 'payout' &&
            type !== 'cashout' &&
            type !== 'withdrawal'
          ) {
            continue
          }
          mergeTx(
            transactions,
            parseWalletTx(
              String(obj.transactionId || `${wallet.walletId}_${transactions.length}`),
              { ...obj, walletId: wallet.walletId, userId: PLATFORM_WALLET_USER_ID },
              walletById,
            ),
          )
        }
      }
    }

    transactions.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    const escrow = escrowSnap.docs
      .filter(d => d.data()?.platformFeeCleared !== true)
      .map(d => parseEscrow(d.id, d.data() as Record<string, unknown>))
    const held = escrow.filter(e => e.status === 'held')
    const collected = escrow.filter(
      e => e.status === 'released' || e.status === 'auto_released',
    )

    const feesHeld = held.reduce((s, e) => s + escrowVeroShare(e), 0)
    const feesCollected = collected.reduce((s, e) => s + escrowVeroShare(e), 0)
    const feeTxs = transactions.filter(t => t.type.toLowerCase() === 'service_fee')
    const processingTxs = transactions.filter(t => t.type.toLowerCase() === 'processing_fee')
    const byService = PLATFORM_SERVICES.filter(id => id !== 'other').map(id => {
      const source = id === 'pawapay' ? processingTxs : feeTxs
      const credited = source
        .filter(t => t.service === id)
        .reduce((s, t) => s + t.amount, 0)
      const waiting =
        id === 'pawapay'
          ? held.reduce((s, e) => s + escrowPawapayShare(e), 0)
          : held
              .filter(e => platformServiceOf({ serviceType: e.serviceType }) === id)
              .reduce((s, e) => s + escrowVeroShare(e), 0)
      const count = source.filter(t => t.service === id).length
      return {
        id,
        label: platformServiceLabel(id),
        credited,
        waiting,
        count,
      }
    })
    const payoutTxs = transactions.filter(isPayoutTx)
    const lifetimeFees = feeTxs.reduce((s, t) => s + t.amount, 0)
    const pawapay = summarizePawaPayFees(transactions)

    // Re-read balance after possible backfill.
    if (wallet && backfill.credited > 0 && walletsSnapDocs[0]) {
      const fresh = await walletsSnapDocs[0].ref.get()
      if (fresh.exists) {
        wallet = parseWallet(fresh.id, fresh.data() as Record<string, unknown>)
      }
    }

    // Prefer canonical doc after backfill merge.
    if (backfill.mergedDuplicates > 0 || backfill.credited > 0) {
      const canonical = await db.collection(WALLETS_COLLECTION).doc('super_admin').get()
      if (canonical.exists) {
        wallet = parseWallet(canonical.id, canonical.data() as Record<string, unknown>)
      }
    }

    return NextResponse.json({
      success: true,
      wallet,
      transactions,
      escrow: escrow.map(e => ({
        id: e.id,
        status: e.status,
        serviceType: e.serviceType,
        orderNumber: e.orderNumber,
        itemName: e.itemName,
        merchantName: e.merchantName,
        merchantAmount: e.merchantAmount,
        serviceFeeAmount: e.serviceFeeAmount,
        feeRate: e.feeRate,
        txRef: e.txRef,
        createdAt: e.createdAt,
        releasedAt: e.releasedAt,
        releaseKind: e.releaseKind,
      })),
      backfill,
      byService,
      summary: {
        balance: wallet?.balance ?? 0,
        pendingBalance: wallet?.pendingBalance ?? 0,
        lifetimeFees,
        feesHeld,
        feesCollected,
        heldCount: held.length,
        feeCount: feeTxs.length,
        payoutTotal: payoutTxs.reduce((s, t) => s + t.amount, 0),
        payoutCount: payoutTxs.length,
        pawapayPayoutFees: pawapay.payoutFees,
        pawapayCollectionFees: pawapay.collectionFees,
        pawapayTotalFees: pawapay.totalFees,
        pawapayPayoutCount: pawapay.payoutCount,
        pawapayCollectionCount: pawapay.collectionCount,
      },
    })
  } catch (err) {
    console.error('Admin wallet GET error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not load super admin wallet from Firestore',
      },
      { status: 502 },
    )
  }
}
