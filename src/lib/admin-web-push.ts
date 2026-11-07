import 'server-only'

import webpush from 'web-push'
import { getAdminDb } from '@/lib/firebase-admin'

const CONFIG_COLLECTION = 'platform_config'
const CONFIG_DOC = 'admin_web_push'
const SUBS_COLLECTION = 'admin_push_subscriptions'
const SUBJECT = 'mailto:support@vero360.com'

type StoredKeys = {
  publicKey: string
  privateKey: string
}

export type AdminPushSubscriptionInput = {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

async function vapidKeys(): Promise<StoredKeys> {
  const ref = getAdminDb().collection(CONFIG_COLLECTION).doc(CONFIG_DOC)
  const snap = await ref.get()
  const data = snap.data() || {}
  const publicKey = String(data.publicKey || '')
  const privateKey = String(data.privateKey || '')
  if (publicKey && privateKey) return { publicKey, privateKey }

  const generated = webpush.generateVAPIDKeys()
  await ref.set(
    {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: SUBJECT,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return generated
}

export async function getAdminPushPublicKey() {
  const keys = await vapidKeys()
  return keys.publicKey
}

function subscriptionId(endpoint: string) {
  return Buffer.from(endpoint).toString('base64url').slice(0, 120)
}

export async function saveAdminPushSubscription(uid: string, input: AdminPushSubscriptionInput) {
  const endpoint = String(input.endpoint || '').trim()
  const p256dh = String(input.keys?.p256dh || '').trim()
  const auth = String(input.keys?.auth || '').trim()
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is incomplete.')
  }
  await getAdminDb()
    .collection(SUBS_COLLECTION)
    .doc(subscriptionId(endpoint))
    .set({
      uid,
      endpoint,
      keys: { p256dh, auth },
      updatedAt: new Date().toISOString(),
    })
}

/** OS notification for every admin device that turned alerts on. Safe to call when nobody is signed in. */
export async function sendAdminPush(input: { title: string; body: string; url: string }) {
  try {
    const keys = await vapidKeys()
    webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey)
    const snaps = await getAdminDb().collection(SUBS_COLLECTION).limit(100).get()
    if (snaps.empty) return { sent: 0 }
    const payload = JSON.stringify({
      title: input.title,
      body: input.body,
      url: input.url.startsWith('/') ? input.url : '/dashboard',
    })
    let sent = 0
    await Promise.all(
      snaps.docs.map(async doc => {
        const data = doc.data()
        const endpoint = String(data.endpoint || '')
        const p256dh = String(data.keys?.p256dh || '')
        const auth = String(data.keys?.auth || '')
        if (!endpoint || !p256dh || !auth) return
        try {
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)
          sent += 1
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await doc.ref.delete().catch(() => undefined)
          } else {
            console.error('Admin push failed:', status || err)
          }
        }
      }),
    )
    return { sent }
  } catch (err) {
    console.error('Admin push:', err)
    return { sent: 0 }
  }
}
