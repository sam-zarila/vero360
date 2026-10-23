import { listBankTransferPayments, type BankTransferPayment } from '@/lib/bank-transfer-payments'

function norm(value: unknown): string {
  return value == null ? '' : String(value).trim().toLowerCase()
}

function bookingKey(value: unknown): string {
  return norm(value).replace(/^#/, '').replace(/^vero/, '')
}

export function adminHrefForBankSource(source: string): string {
  switch (norm(source)) {
    case 'marketplace':
    case 'checkout':
      return '/dashboard/orders'
    case 'food':
      return '/dashboard/food'
    case 'stay':
    case 'accommodation':
      return '/dashboard/stay?tab=bookings'
    case 'digital':
      return '/dashboard/digital-services'
    default:
      return '/dashboard/finance?tab=bank_proofs'
  }
}

export function bankSourceLabel(source: string): string {
  switch (norm(source)) {
    case 'marketplace':
    case 'checkout':
      return 'marketplace'
    case 'food':
      return 'food'
    case 'stay':
    case 'accommodation':
      return 'accommodation'
    case 'digital':
      return 'digital'
    default:
      return source || 'bank transfer'
  }
}

export async function loadBankTransferProofs(limit = 300): Promise<BankTransferPayment[]> {
  try {
    return await listBankTransferPayments(limit)
  } catch (err) {
    console.warn('[bank-transfer-enrich] list failed', err)
    return []
  }
}

export function matchBankProofForMarketplace(
  proofs: BankTransferPayment[],
  input: { id: number | string; orderNumber?: string | null; description?: string | null },
): BankTransferPayment | null {
  const id = String(input.id)
  const orderNo = str(input.orderNumber)
  const desc = str(input.description)
  return (
    proofs.find(p => p.orderIds.includes(id) || (orderNo && p.orderNumbers.includes(orderNo))) ||
    proofs.find(p => p.txRef && desc.includes(p.txRef)) ||
    null
  )
}

export function matchBankProofForFood(
  proofs: BankTransferPayment[],
  input: { id: string; paymentTxRef?: string | null },
): BankTransferPayment | null {
  const id = str(input.id)
  const tx = str(input.paymentTxRef)
  return (
    proofs.find(p => p.foodOrderId === id) ||
    proofs.find(p => tx && (p.txRef === tx || p.id === tx)) ||
    null
  )
}

export function matchBankProofForStay(
  proofs: BankTransferPayment[],
  input: { bookingNumber?: string | null; id?: number | string },
): BankTransferPayment | null {
  const keys = new Set(
    [input.bookingNumber, input.id]
      .map(bookingKey)
      .filter(Boolean),
  )
  if (!keys.size) return null
  return (
    proofs.find(p => {
      const ref = bookingKey(p.stayBookingRef)
      return ref && keys.has(ref)
    }) || null
  )
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}
