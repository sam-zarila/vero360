import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  ORDER_ESCROW_COLLECTION,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
  buildFinanceSummary,
  isPayoutTx,
  parseEscrow,
  parseWallet,
  parseWalletTx,
  withWalletPayoutTotals,
  type EscrowRow,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'
import { enrichFinanceMerchants } from '@/lib/enrich-finance'

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

    const [walletsSnap, txSnap, payoutSnap, escrowSnap] = await Promise.all([
      db.collection(WALLETS_COLLECTION).get(),
      db
        .collection(WALLET_TX_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get()
        .catch(async () => db.collection(WALLET_TX_COLLECTION).limit(500).get()),
      // Explicit payout ledger so cash-outs are not missed if mixed with other recent txs.
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'payout')
        .limit(1000)
        .get()
        .catch(async () => {
          // Fallback without index / type filter
          return db.collection(WALLET_TX_COLLECTION).limit(1000).get()
        }),
      db.collection(ORDER_ESCROW_COLLECTION).get(),
    ])

    let wallets: WalletRow[] = walletsSnap.docs
      .map(d => parseWallet(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.balance - a.balance)

    const walletById = new Map(wallets.map(w => [w.walletId, w]))

    const transactions: WalletTxRow[] = []
    for (const d of txSnap.docs) {
      mergeTx(
        transactions,
        parseWalletTx(d.id, d.data() as Record<string, unknown>, walletById),
      )
    }
    for (const d of payoutSnap.docs) {
      mergeTx(
        transactions,
        parseWalletTx(d.id, d.data() as Record<string, unknown>, walletById),
      )
    }

    // Also surface embedded wallet.transactions (app writes both places)
    for (const doc of walletsSnap.docs) {
      const data = doc.data() as Record<string, unknown>
      const list = data.transactions
      if (!Array.isArray(list)) continue
      const wallet = walletById.get(doc.id) || parseWallet(doc.id, data)
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue
        mergeTx(
          transactions,
          parseWalletTx(
            String(
              (raw as { transactionId?: string }).transactionId ||
                `${doc.id}_${transactions.length}`,
            ),
            { ...(raw as Record<string, unknown>), walletId: doc.id },
            new Map([[doc.id, wallet]]),
          ),
        )
      }
    }

    const allTxSorted = transactions.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    wallets = withWalletPayoutTotals(wallets, allTxSorted)

    const enriched = await enrichFinanceMerchants(wallets, allTxSorted)
    wallets = enriched.wallets.sort((a, b) => {
      if (b.payoutTotal !== a.payoutTotal) return b.payoutTotal - a.payoutTotal
      return b.balance - a.balance
    })
    const allTx = enriched.transactions

    const escrow: EscrowRow[] = escrowSnap.docs
      .map(d => parseEscrow(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => {
        const at = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0
        const bt = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0
        return bt - at
      })

    const summary = buildFinanceSummary(wallets, allTx, escrow)
    const payouts = allTx.filter(isPayoutTx)

    return NextResponse.json({
      success: true,
      summary,
      wallets,
      transactions: allTx,
      payouts,
      escrow,
      counts: {
        wallets: wallets.length,
        transactions: allTx.length,
        escrow: escrow.length,
        escrowHeld: escrow.filter(e => e.status === 'held').length,
        escrowReleased: escrow.filter(
          e => e.status === 'released' || e.status === 'auto_released',
        ).length,
        payouts: payouts.length,
      },
    })
  } catch (err) {
    console.error('Admin finance GET error:', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not load finance data from Firestore',
      },
      { status: 502 },
    )
  }
}
