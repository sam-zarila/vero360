import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  PLATFORM_WALLET_USER_ID,
  WALLETS_COLLECTION,
  WALLET_TX_COLLECTION,
  parseWallet,
} from '@/lib/finance'
import { initializePaychanguPayout } from '@/lib/paychangu'
import {
  MIN_PAYOUT_MWK,
  PAYOUT_BANKS,
  PAYOUT_MOMO,
  normalizeMalawiMobile,
} from '@/lib/payout-destinations'

export async function POST(request: Request) {
  try {
    await requireSuperAdmin(request)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const method = String(body.method || '').trim()
  const amount = Math.round(Number(body.amount))
  const email = String(body.email || '').trim()

  if (method !== 'bank' && method !== 'mobile_money') {
    return NextResponse.json(
      { error: 'Choose bank transfer or mobile money.' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(amount) || amount < MIN_PAYOUT_MWK) {
    return NextResponse.json(
      { error: `Minimum withdrawal is MWK ${MIN_PAYOUT_MWK.toLocaleString()}.` },
      { status: 400 },
    )
  }

  try {
    const db = getAdminDb()
    const walletsSnap = await db
      .collection(WALLETS_COLLECTION)
      .where('userId', '==', PLATFORM_WALLET_USER_ID)
      .limit(1)
      .get()

    if (walletsSnap.empty) {
      return NextResponse.json(
        { error: 'Admin wallet not found yet. Fees create it on first escrow release.' },
        { status: 404 },
      )
    }

    const walletDoc = walletsSnap.docs[0]
    const wallet = parseWallet(
      walletDoc.id,
      walletDoc.data() as Record<string, unknown>,
    )
    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient admin wallet balance.' },
        { status: 400 },
      )
    }

    const chargeId = `PAYOUT-admin-${Date.now()}`
    let description: string
    let payoutMethod: string
    let bankName: string | null = null
    let accountNumber: string | null = null
    let recipientName: string | null = null
    let recipientPhone: string | null = null

    if (method === 'bank') {
      const bankUuid = String(body.bankUuid || '').trim()
      const accountName = String(body.accountName || '').trim()
      const accNo = String(body.accountNumber || '').trim()
      const bank = PAYOUT_BANKS.find(b => b.uuid === bankUuid)
      if (!bank) {
        return NextResponse.json({ error: 'Select a bank.' }, { status: 400 })
      }
      if (!accountName || !accNo) {
        return NextResponse.json(
          { error: 'Account name and number are required.' },
          { status: 400 },
        )
      }
      await initializePaychanguPayout({
        method: 'bank',
        amount,
        chargeId,
        bankUuid,
        accountName,
        accountNumber: accNo,
        email: email || undefined,
      })
      description = `Bank Transfer Payout (${bank.name})`
      payoutMethod = 'bank'
      bankName = bank.name
      accountNumber = accNo
      recipientName = accountName
    } else {
      const operatorId = String(body.operatorId || '').trim()
      const mobile = normalizeMalawiMobile(String(body.phone || ''))
      const momo = PAYOUT_MOMO.find(m => m.id === operatorId)
      if (!momo) {
        return NextResponse.json(
          { error: 'Select Airtel Money or MPamba.' },
          { status: 400 },
        )
      }
      if (!/^0\d{8,9}$/.test(mobile)) {
        return NextResponse.json(
          { error: 'Enter a valid Malawi mobile number (e.g. 0999xxxxxx).' },
          { status: 400 },
        )
      }
      await initializePaychanguPayout({
        method: 'mobile_money',
        amount,
        chargeId,
        operatorId,
        mobile,
        email: email || undefined,
      })
      description = `${momo.name} Payout (admin)`
      payoutMethod = 'mobile_money'
      recipientPhone = mobile
      recipientName = momo.name
    }

    const transactionId = `TXN${Date.now()}`
    const now = Timestamp.now()
    const txPayload: Record<string, unknown> = {
      transactionId,
      walletId: wallet.walletId,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'payout',
      amount,
      status: 'completed',
      description,
      reference: chargeId,
      createdAt: now,
      updatedAt: now,
      payoutMethod,
      bankName,
      accountNumber,
      recipientName,
      recipientPhone,
      fee: null,
    }

    let newBalance = wallet.balance - amount
    await db.runTransaction(async txn => {
      const ref = db.collection(WALLETS_COLLECTION).doc(walletDoc.id)
      const snap = await txn.get(ref)
      if (!snap.exists) throw new Error('Wallet not found')
      const data = snap.data() as Record<string, unknown>
      const current = Number(data.balance) || 0
      if (current < amount) throw new Error('Insufficient balance')
      newBalance = current - amount
      const list = Array.isArray(data.transactions)
        ? [...(data.transactions as Record<string, unknown>[])]
        : []
      list.push(txPayload)
      txn.update(ref, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
        transactions: list,
      })
    })

    await db.collection(WALLET_TX_COLLECTION).doc(transactionId).set(txPayload)

    return NextResponse.json({
      success: true,
      balance: newBalance,
      transactionId,
      reference: chargeId,
    })
  } catch (err) {
    console.error('Admin wallet payout error:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Could not complete cash-out',
      },
      { status: 502 },
    )
  }
}
