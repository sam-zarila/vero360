import { NextResponse } from 'next/server'
import { getStoredDeposit } from '@/lib/pawapay-deposits'
import { refreshAndSettleDeposit } from '@/lib/pawapay-settle'

export const dynamic = 'force-dynamic'

function payloadDepositId(body: Record<string, unknown>): string {
  const direct = String(body.depositId || '').trim()
  if (direct) return direct
  const data = body.data
  if (data && typeof data === 'object') {
    return String((data as Record<string, unknown>).depositId || '').trim()
  }
  return ''
}

/** PawaPay deposit callback. Only deposits this site created are settled. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const depositId = payloadDepositId(body)
    if (!depositId) return NextResponse.json({ ok: true, ignored: true })

    const known = await getStoredDeposit(depositId)
    if (!known) return NextResponse.json({ ok: true, ignored: true })

    const result = await refreshAndSettleDeposit(depositId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('PawaPay callback:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Callback failed' },
      { status: 400 },
    )
  }
}
