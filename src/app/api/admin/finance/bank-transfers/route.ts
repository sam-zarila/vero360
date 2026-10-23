import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole } from '@/lib/admins'
import {
  bankTransferSourceGroup,
  isBankTransferPending,
  listBankTransferPayments,
} from '@/lib/bank-transfer-payments'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const items = await listBankTransferPayments()
    const pendingItems = items.filter(i => isBankTransferPending(i.status))
    const confirmedItems = items.filter(
      i => i.status === 'confirmed' || i.status === 'paid',
    )
    const grouped = {
      marketplace: items.filter(i => bankTransferSourceGroup(i.source) === 'marketplace'),
      food: items.filter(i => bankTransferSourceGroup(i.source) === 'food'),
      stay: items.filter(i => bankTransferSourceGroup(i.source) === 'stay'),
      digital: items.filter(i => bankTransferSourceGroup(i.source) === 'digital'),
    }
    const sum = (rows: typeof items) => rows.reduce((s, i) => s + (i.amountMwk || 0), 0)
    const bySource = {
      marketplace: grouped.marketplace.length,
      food: grouped.food.length,
      stay: grouped.stay.length,
      digital: grouped.digital.length,
    }
    const bySourceAmountMwk = {
      marketplace: sum(grouped.marketplace),
      food: sum(grouped.food),
      stay: sum(grouped.stay),
      digital: sum(grouped.digital),
    }
    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      pending: pendingItems.length,
      confirmed: confirmedItems.length,
      pendingAmountMwk: sum(pendingItems),
      confirmedAmountMwk: sum(confirmedItems),
      bySource,
      bySourceAmountMwk,
    })
  } catch (err) {
    console.error('Admin bank-transfers GET:', err)
    return NextResponse.json({ error: 'Could not load bank transfer proofs' }, { status: 502 })
  }
}
