import 'server-only'

import { sendAdminPush } from '@/lib/admin-web-push'
import { isBankTransferPending, listBankTransferPayments } from '@/lib/bank-transfer-payments'
import { isDigitalOrderPaid } from '@/lib/digital-services'
import { listDigitalServiceOrders } from '@/lib/digital-services-admin'
import { getAdminDb } from '@/lib/firebase-admin'
import { parseMarketplaceOrders } from '@/lib/orders'
import { getVeroAuthHeader, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

const CURSOR_DOC = 'admin_alert_cursor'
const MAX_PUSHES = 8

type Cursor = {
  digital: string[]
  bank: string[]
  orders: string[]
}

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 300) : []
}

async function loadCursor(): Promise<{ cursor: Cursor; first: boolean }> {
  const snap = await getAdminDb().collection('platform_config').doc(CURSOR_DOC).get()
  if (!snap.exists) {
    return { cursor: { digital: [], bank: [], orders: [] }, first: true }
  }
  const data = snap.data() || {}
  return {
    first: false,
    cursor: {
      digital: asIds(data.digital),
      bank: asIds(data.bank),
      orders: asIds(data.orders),
    },
  }
}

async function saveCursor(cursor: Cursor) {
  await getAdminDb()
    .collection('platform_config')
    .doc(CURSOR_DOC)
    .set({ ...cursor, at: new Date().toISOString() })
}

async function recentMarketplaceIds() {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const auth = getVeroAuthHeader()
  if (auth) headers.Authorization = auth
  const res = await fetch(veroEndpoint('orders', 'admin', 'all'), {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) return [] as Array<{ id: string; label: string }>
  const body = await readJsonSafe(res)
  return parseMarketplaceOrders(body)
    .sort((a, b) => {
      const at = a.orderDate ? new Date(a.orderDate).getTime() : 0
      const bt = b.orderDate ? new Date(b.orderDate).getTime() : 0
      return bt - at
    })
    .slice(0, 40)
    .map(order => ({
      id: String(order.id),
      label: `${order.orderNumber || order.id}${order.itemName ? ` · ${order.itemName}` : ''}`,
    }))
    .filter(order => order.id)
}

/**
 * Compare the latest orders with the last scan and push anything new.
 * The first run only remembers current ids so old history is not blasted out.
 */
export async function scanAndPushAdminAlerts() {
  const { cursor, first } = await loadCursor()
  const [digitalAll, bankAll] = await Promise.all([
    listDigitalServiceOrders({ limit: 80 }),
    listBankTransferPayments(40),
  ])

  const digital = digitalAll
    .filter(order => order.amountMwk > 0 && isDigitalOrderPaid(order))
    .slice(0, 40)
    .map(order => ({
      id: order.id,
      label: `${order.productName}${order.buyerName ? ` · ${order.buyerName}` : ''}`,
    }))
  const bank = bankAll
    .filter(payment => isBankTransferPending(payment.status))
    .slice(0, 40)
    .map(payment => ({
      id: payment.id,
      label: `${payment.title}${payment.buyerName ? ` · ${payment.buyerName}` : ''}`,
    }))

  let orders: Array<{ id: string; label: string }> = []
  try {
    orders = await recentMarketplaceIds()
  } catch (err) {
    console.error('Admin alert scan orders:', err)
  }

  const next: Cursor = {
    digital: digital.map(item => item.id),
    bank: bank.map(item => item.id),
    orders: orders.map(item => item.id),
  }

  if (first) {
    await saveCursor(next)
    return { baselined: true, pushed: 0 }
  }

  const knownDigital = new Set(cursor.digital)
  const knownBank = new Set(cursor.bank)
  const knownOrders = new Set(cursor.orders)
  const fresh: Array<{ title: string; body: string; url: string }> = []

  for (const item of digital) {
    if (!knownDigital.has(item.id)) {
      fresh.push({
        title: 'Digital order paid',
        body: item.label,
        url: '/dashboard/digital-services',
      })
    }
  }
  for (const item of bank) {
    if (!knownBank.has(item.id)) {
      fresh.push({
        title: 'Bank transfer waiting',
        body: item.label,
        url: '/dashboard/bank-transfers',
      })
    }
  }
  for (const item of orders) {
    if (!knownOrders.has(item.id)) {
      fresh.push({
        title: 'New marketplace order',
        body: item.label,
        url: '/dashboard/orders',
      })
    }
  }

  for (const item of fresh.slice(0, MAX_PUSHES)) {
    await sendAdminPush(item)
  }
  await saveCursor(next)
  return { baselined: false, pushed: Math.min(fresh.length, MAX_PUSHES) }
}
