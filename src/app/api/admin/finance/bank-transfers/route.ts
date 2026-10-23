import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole } from '@/lib/admins'
import { listBankTransferPayments } from '@/lib/bank-transfer-payments'

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
    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      pending: items.filter(i => i.status !== 'confirmed' && i.status !== 'paid').length,
    })
  } catch (err) {
    console.error('Admin bank-transfers GET:', err)
    return NextResponse.json({ error: 'Could not load bank transfer proofs' }, { status: 502 })
  }
}
