import { NextResponse } from 'next/server'
import {
  getBankTransferConfig,
  publicBankTransferPayload,
} from '@/lib/bank-transfer-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getBankTransferConfig()
    return NextResponse.json(publicBankTransferPayload(config))
  } catch (err) {
    console.error('Public bank-transfer GET:', err)
    return NextResponse.json({ enabled: false })
  }
}
