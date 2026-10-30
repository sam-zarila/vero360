import 'server-only'

import {
  findDigitalOrderByTxRef,
  settleDigitalOrderPayment,
} from '@/lib/digital-services-checkout'
import { getAdminDb } from '@/lib/firebase-admin'
import { DIGITAL_SERVICE_ORDERS_COLLECTION } from '@/lib/digital-services'
import { fulfillCourierGuestOrder } from '@/lib/courier-public'
import {
  findGuestOrderById,
  findGuestOrderByTxRef,
  settleGuestOrderPayment,
  WEB_GUEST_ORDERS_COLLECTION,
} from '@/lib/guest-checkout'
import {
  findMarketplacePromotionByTxRef,
  settleMarketplacePromotionPayment,
} from '@/lib/marketplace-promotions-admin'
import {
  confirmPawaPayReference,
  refreshStoredDeposit,
  type StoredPawaPayDeposit,
} from '@/lib/pawapay-deposits'
import { recordAudit } from '@/lib/audit-trail-admin'

export async function settleConfirmedDeposit(deposit: StoredPawaPayDeposit) {
  if (deposit.status !== 'completed') {
    return {
      success: true,
      paid: false,
      status: deposit.status || 'pending',
      failure: deposit.failure,
      depositId: deposit.depositId,
      orderId: deposit.orderId,
      txRef: deposit.reference,
    }
  }

  const txRef = deposit.reference.trim()
  const orderHint = deposit.orderId.trim()

  let orderId = orderHint
  if (orderId) {
    const snap = await getAdminDb()
      .collection(DIGITAL_SERVICE_ORDERS_COLLECTION)
      .doc(orderId)
      .get()
    if (!snap.exists) orderId = ''
    else if (String(snap.data()?.txRef || '') !== txRef) orderId = ''
  }
  if (!orderId && txRef) {
    const found = await findDigitalOrderByTxRef(txRef)
    if (found) orderId = found.id
  }

  if (orderId) {
    const settled = await settleDigitalOrderPayment({ orderId, txRef })
    if (!settled.alreadyPaid) {
      await recordAudit({
        action: 'settle',
        resource: 'payment',
        resourceId: orderId,
        summary: `PawaPay paid digital order ${orderId} (${txRef})`,
        actorUid: 'pawapay',
        actorEmail: '',
        actorName: 'PawaPay',
        actorRole: 'webhook',
      })
    }
    return {
      success: true,
      paid: true,
      status: 'paid',
      orderId,
      txRef,
      depositId: deposit.depositId,
      alreadyPaid: settled.alreadyPaid,
      kind: 'digital_order',
    }
  }

  let guestOrderId = ''
  const guestKind = String(deposit.kind || '')
  const isGuestKind =
    guestKind === 'marketplace_order' ||
    guestKind === 'food_order' ||
    guestKind === 'stay_booking' ||
    guestKind === 'courier_delivery'
  if (isGuestKind && orderHint) {
    const snap = await getAdminDb()
      .collection(WEB_GUEST_ORDERS_COLLECTION)
      .doc(orderHint)
      .get()
    if (snap.exists && String(snap.data()?.txRef || '') === txRef) {
      guestOrderId = orderHint
    }
  }
  if (!guestOrderId && txRef) {
    const found = await findGuestOrderByTxRef(txRef)
    if (found) guestOrderId = found.id
  }
  if (guestOrderId) {
    const settled = await settleGuestOrderPayment({
      orderId: guestOrderId,
      txRef,
    })
    let trackingNumber = ''
    if (settled.kind === 'courier') {
      const latest = await findGuestOrderById(guestOrderId)
      const fulfilled = await fulfillCourierGuestOrder({
        orderId: guestOrderId,
        data: latest?.data || settled.data,
      })
      trackingNumber = fulfilled.trackingNumber
    }
    if (!settled.alreadyPaid) {
      await recordAudit({
        action: 'settle',
        resource: 'payment',
        resourceId: guestOrderId,
        summary: `PawaPay paid ${settled.kind} guest order ${guestOrderId} (${txRef})`,
        actorUid: 'pawapay',
        actorEmail: '',
        actorName: 'PawaPay',
        actorRole: 'webhook',
      })
    }
    return {
      success: true,
      paid: true,
      status: 'paid',
      orderId: guestOrderId,
      txRef,
      depositId: deposit.depositId,
      alreadyPaid: settled.alreadyPaid,
      kind: settled.kind,
      trackingNumber,
    }
  }

  const promo = txRef ? await findMarketplacePromotionByTxRef(txRef) : null
  if (promo) {
    const settled = await settleMarketplacePromotionPayment({
      promoId: promo.id,
      txRef,
      alreadyConfirmed: true,
    })
    if (settled.paid && !settled.alreadyPaid) {
      await recordAudit({
        action: 'settle',
        resource: 'payment',
        resourceId: settled.promo.id,
        summary: `PawaPay paid promotion ${settled.promo.id} (${txRef})`,
        actorUid: 'pawapay',
        actorEmail: '',
        actorName: 'PawaPay',
        actorRole: 'webhook',
      })
    }
    return {
      success: true,
      paid: settled.paid,
      status: settled.promo.status,
      promoId: settled.promo.id,
      txRef,
      depositId: deposit.depositId,
      alreadyPaid: settled.alreadyPaid,
      kind: 'marketplace_promotion',
      message: settled.message,
    }
  }

  return {
    success: true,
    paid: true,
    status: 'completed',
    depositId: deposit.depositId,
    txRef,
    kind: 'deposit',
  }
}

export async function refreshAndSettleDeposit(depositId: string) {
  const deposit = await refreshStoredDeposit(depositId)
  if (!deposit) throw new Error('Payment not found')
  return settleConfirmedDeposit(deposit)
}

export async function refreshAndSettleReference(txRef: string, orderId?: string) {
  const confirmed = await confirmPawaPayReference(txRef)
  if (!confirmed.depositId) {
    return {
      success: false,
      paid: false,
      status: 'pending',
      txRef,
      orderId: orderId || '',
    }
  }
  return refreshAndSettleDeposit(confirmed.depositId)
}
