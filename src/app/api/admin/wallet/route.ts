import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  ORDER_ESCROW_COLLECTION,
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
  isPayoutTx,
  parseEscrow,
  parseWallet,
  parseWalletTx,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'

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

    const [walletsSnap, feeSnap, payoutSnap, escrowSnap] = await Promise.all([
      db
        .collection(WALLETS_COLLECTION)
        .where('userId', '==', PLATFORM_WALLET_USER_ID)
        .limit(5)
        .get(),
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'service_fee')
        .limit(500)
        .get()
        .catch(() => db.collection(WALLET_TX_COLLECTION).limit(500).get()),
      db
        .collection(WALLET_TX_COLLECTION)
        .where('type', '==', 'payout')
        .limit(500)
        .get()
        .catch(() => null),
      db.collection(ORDER_ESCROW_COLLECTION).get(),
    ])

    let wallet: WalletRow | null = walletsSnap.docs[0]
      ? parseWallet(
          walletsSnap.docs[0].id,
          walletsSnap.docs[0].data() as Record<string, unknown>,
        )
      : null

    const walletById = new Map<string, WalletRow>()
    if (wallet) walletById.set(wallet.walletId, wallet)

    const belongsToPlatform = (row: WalletTxRow) => {
      if (row.userId === PLATFORM_WALLET_USER_ID) return true
      if (wallet && row.walletId && row.walletId === wallet.walletId) return true
      // Older service-fee rows sometimes omit wallet/user ids.
      if (row.type.toLowerCase() === 'service_fee' && !row.walletId && !row.userId) {
        return true
      }
      return false
    }

    const transactions: WalletTxRow[] = []
    const ingest = (docs: typeof feeSnap.docs) => {
      for (const d of docs) {
        const row = parseWalletTx(d.id, d.data() as Record<string, unknown>, walletById)
        const type = row.type.toLowerCase()
        if (type !== 'service_fee' && !isPayoutTx(row)) continue
        if (!belongsToPlatform(row)) continue
        mergeTx(transactions, row)
      }
    }
    ingest(feeSnap.docs)
    if (payoutSnap) ingest(payoutSnap.docs)

    if (wallet) {
      const data = walletsSnap.docs[0].data() as Record<string, unknown>
      const list = data.transactions
      if (Array.isArray(list)) {
        for (const raw of list) {
          if (!raw || typeof raw !== 'object') continue
          const obj = raw as Record<string, unknown>
          const type = String(obj.type || '').toLowerCase()
          if (type !== 'service_fee' && type !== 'payout' && type !== 'cashout' && type !== 'withdrawal') {
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

    const escrow = escrowSnap.docs.map(d =>
      parseEscrow(d.id, d.data() as Record<string, unknown>),
    )
    const held = escrow.filter(e => e.status === 'held')
    const collected = escrow.filter(
      e => e.status === 'released' || e.status === 'auto_released',
    )

    const feesHeld = held.reduce((s, e) => s + e.serviceFeeAmount, 0)
    const feesCollected = collected.reduce((s, e) => s + e.serviceFeeAmount, 0)
    const feeTxs = transactions.filter(t => t.type.toLowerCase() === 'service_fee')
    const payoutTxs = transactions.filter(isPayoutTx)
    const lifetimeFees = feeTxs.reduce((s, t) => s + t.amount, 0)

    return NextResponse.json({
      success: true,
      wallet,
      transactions,
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
