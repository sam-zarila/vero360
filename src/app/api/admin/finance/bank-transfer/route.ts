import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isFullAdminRole } from '@/lib/admins'
import {
  getBankTransferConfig,
  saveBankTransferConfig,
} from '@/lib/bank-transfer-config'

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
    const config = await getBankTransferConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin bank-transfer GET:', err)
    return NextResponse.json({ error: 'Failed to load bank details' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = (await request.json().catch(() => null)) as {
      enabled?: boolean
      bankName?: string
      accountName?: string
      accountNumber?: string
      branch?: string
    } | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await saveBankTransferConfig({
      enabled: body.enabled,
      bankName: body.bankName,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      branch: body.branch,
      updatedByEmail: actor.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: config.enabled
        ? 'Bank transfer is ON. Customers can see these details at checkout.'
        : 'Bank transfer is OFF. Details are hidden in the app and on the web.',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin bank-transfer PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    )
  }
}
