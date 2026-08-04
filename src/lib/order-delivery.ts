import { getAdminDb } from '@/lib/firebase-admin'
import {
  applyDeliveryMeta,
  type DeliveryMeta,
  type MarketplaceOrder,
} from '@/lib/orders'

/** Same collection as Flutter `DeliveryProofService.collection`. */
export const DELIVERY_PROOF_COLLECTION = 'order_delivery_proofs'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function metaFromDoc(data: Record<string, unknown>): DeliveryMeta {
  const proofUrl = str(data.proofUrl)
  const courierMethod = str(data.courierMethod || data.method).toLowerCase()
  const tracking = str(data.tracking)
  return {
    proofUrl: proofUrl || null,
    courierMethod: courierMethod || null,
    tracking: tracking || null,
  }
}

async function loadDeliveryMeta(docId: string): Promise<DeliveryMeta | null> {
  const id = docId.trim()
  if (!id) return null
  try {
    const snap = await getAdminDb().collection(DELIVERY_PROOF_COLLECTION).doc(id).get()
    if (!snap.exists) return null
    const meta = metaFromDoc(snap.data() as Record<string, unknown>)
    if (!meta.proofUrl && !meta.courierMethod && !meta.tracking) return null
    return meta
  } catch (err) {
    console.warn('[order-delivery] Firestore lookup failed', id, err)
    return null
  }
}

/**
 * Attach courier + shipment proof from Firestore `order_delivery_proofs`
 * (written by the app when merchants ship). Doc id = backend order id string.
 */
export async function enrichOrderDelivery(
  orders: MarketplaceOrder[],
): Promise<MarketplaceOrder[]> {
  if (orders.length === 0) return orders

  const keys = new Set<string>()
  for (const o of orders) {
    keys.add(String(o.id))
    const orderNo = o.orderNumber.trim()
    if (orderNo) keys.add(orderNo)
  }

  const cache = new Map<string, DeliveryMeta | null>()
  await Promise.all(
    [...keys].map(async key => {
      cache.set(key, await loadDeliveryMeta(key))
    }),
  )

  return orders.map(order => {
    const byId = cache.get(String(order.id))
    const byNumber = cache.get(order.orderNumber.trim())
    const merged: DeliveryMeta = {
      courierMethod: byId?.courierMethod || byNumber?.courierMethod || null,
      tracking: byId?.tracking || byNumber?.tracking || null,
      proofUrl: byId?.proofUrl || byNumber?.proofUrl || null,
    }
    return applyDeliveryMeta(order, merged)
  })
}
