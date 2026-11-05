import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { sendFcmToUid } from '@/lib/courier-push'
import { isAppBuyerUid } from '@/lib/digital-payout-kyc'
import { sendSubscriptionEndingEmail } from '@/lib/digital-services-email'
import {
  DIGITAL_SERVICE_ORDERS_COLLECTION,
  getSubscriptionTiming,
  isDigitalOrderPaid,
  isDigitalSubscription,
  type DigitalServiceOrder,
} from '@/lib/digital-services'
import { parseDigitalServiceOrder } from '@/lib/digital-services-admin'
import { getAdminDb } from '@/lib/firebase-admin'

/** 10 days before, then again at 5 days, then the day before it ends. */
const STAGES = [
  { key: '10', minDays: 6, maxDays: 10 },
  { key: '5', minDays: 2, maxDays: 5 },
  { key: '1', minDays: 0, maxDays: 1 },
] as const

type StageKey = (typeof STAGES)[number]['key']

function stageFor(daysRemaining: number): StageKey | null {
  if (daysRemaining < 0) return null
  for (const stage of STAGES) {
    if (daysRemaining <= stage.maxDays && daysRemaining >= stage.minDays) return stage.key
  }
  return null
}

function sentStages(data: Record<string, unknown>): Set<string> {
  const raw = data.renewalReminders
  if (!raw || typeof raw !== 'object') return new Set()
  return new Set(Object.keys(raw as Record<string, unknown>))
}

function endDateLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Blantyre',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function reminderCopy(order: DigitalServiceOrder, daysLeft: number, endLabel: string) {
  const product = order.productName.trim() || 'Your subscription'
  const when = daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`
  return {
    title: `${product} ends ${when}`,
    body: `${product} ends on ${endLabel}. Renew it in Digital Services before then so it does not stop.`,
  }
}

async function pushToAppUser(order: DigitalServiceOrder, title: string, body: string): Promise<boolean> {
  const uid = order.buyerUid.trim()
  if (!isAppBuyerUid(uid, false)) return false
  let queued = false
  try {
    await getAdminDb().collection('order_party_alerts').add({
      toUid: uid,
      title,
      body,
      payload: {
        type: 'subscription_reminder',
        orderId: order.id,
        productName: order.productName,
        badgeRoute: 'quick_digital_orders',
      },
      createdAt: FieldValue.serverTimestamp(),
      consumed: false,
      read: false,
    })
    queued = true
  } catch (err) {
    console.warn('Subscription reminder inbox:', err)
  }
  try {
    const fcm = await sendFcmToUid(uid, title, body, {
      type: 'subscription_reminder',
      orderId: order.id,
      productName: order.productName,
      badgeRoute: 'quick_digital_orders',
    })
    if (fcm.sent > 0) queued = true
  } catch (err) {
    console.warn('Subscription reminder push:', err)
  }
  return queued
}

export async function sendDueSubscriptionReminders(): Promise<{
  scanned: number
  emailed: number
  pushed: number
  skipped: number
}> {
  const db = getAdminDb()
  let snap
  try {
    snap = await db.collection(DIGITAL_SERVICE_ORDERS_COLLECTION).where('kind', '==', 'subscription').get()
  } catch {
    snap = await db.collection(DIGITAL_SERVICE_ORDERS_COLLECTION).limit(1000).get()
  }

  let emailed = 0
  let pushed = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>
    const order = parseDigitalServiceOrder(doc.id, data)
    if (!isDigitalSubscription(order) || !isDigitalOrderPaid(order)) {
      skipped += 1
      continue
    }
    const timing = getSubscriptionTiming(order)
    if (!timing.endDate || timing.daysRemaining == null || timing.isExpired) {
      skipped += 1
      continue
    }
    const stage = stageFor(timing.daysRemaining)
    if (!stage || sentStages(data).has(stage)) {
      skipped += 1
      continue
    }

    const copy = reminderCopy(order, timing.daysRemaining, endDateLabel(timing.endDate))
    const guest = order.isGuest || !isAppBuyerUid(order.buyerUid, order.isGuest)
    const sent = guest
      ? await sendSubscriptionEndingEmail({
          to: order.buyerEmail,
          buyerName: order.buyerName,
          productName: order.productName,
          endDateLabel: endDateLabel(timing.endDate),
          daysLeft: timing.daysRemaining,
        })
      : await pushToAppUser(order, copy.title, copy.body)

    if (!sent) {
      skipped += 1
      continue
    }
    await doc.ref.update({
      [`renewalReminders.${stage}`]: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (guest) emailed += 1
    else pushed += 1
  }

  return { scanned: snap.size, emailed, pushed, skipped }
}
