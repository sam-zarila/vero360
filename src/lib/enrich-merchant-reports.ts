import 'server-only'

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import { resolveStorageDownloadUrl } from '@/lib/firebase-storage-url'
import { type MerchantReport } from '@/lib/merchant-reports'

const AUTH_BATCH = 100

type Contact = {
  name: string
  email: string
  phone: string
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function cleanEmail(raw: string): string {
  const e = raw.trim()
  if (!e) return ''
  const lower = e.toLowerCase()
  if (lower.endsWith('@phone.vero360.app') || lower.endsWith('@firebase.vero.local')) {
    return ''
  }
  return e
}

function nameFromMap(data: Record<string, unknown>): string {
  for (const key of [
    'businessName',
    'merchantName',
    'displayName',
    'fullName',
    'name',
    'givenName',
  ]) {
    const v = str(data[key])
    if (v) return v
  }
  return ''
}

function contactFromMap(data: Record<string, unknown>): Contact {
  return {
    name: nameFromMap(data),
    email:
      cleanEmail(str(data.email)) ||
      cleanEmail(str(data.userEmail)) ||
      cleanEmail(str(data.contactEmail)),
    phone: str(data.phone) || str(data.phoneNumber) || str(data.mobile),
  }
}

function mergeContact(base: Contact, extra: Contact): Contact {
  return {
    name: base.name || extra.name,
    email: base.email || extra.email,
    phone: base.phone || extra.phone,
  }
}

async function loadMerchantContact(merchantId: string): Promise<Contact> {
  const id = merchantId.trim()
  if (!id) return { name: '', email: '', phone: '' }

  const db = getAdminDb()
  const [merchantSnap, userSnap, accomSnap] = await Promise.all([
    db.collection('marketplace_merchants').doc(id).get(),
    db.collection('users').doc(id).get(),
    db.collection('accommodation_merchants').doc(id).get(),
  ])

  let contact: Contact = { name: '', email: '', phone: '' }
  if (merchantSnap.exists) {
    contact = mergeContact(contact, contactFromMap(merchantSnap.data() as Record<string, unknown>))
  }
  if (accomSnap.exists) {
    contact = mergeContact(contact, contactFromMap(accomSnap.data() as Record<string, unknown>))
  }
  if (userSnap.exists) {
    contact = mergeContact(contact, contactFromMap(userSnap.data() as Record<string, unknown>))
  }

  return contact
}

async function loadAuthContacts(uids: string[]): Promise<Map<string, Contact>> {
  const out = new Map<string, Contact>()
  if (uids.length === 0) return out

  const auth = getAdminAuth()
  for (let i = 0; i < uids.length; i += AUTH_BATCH) {
    const chunk = uids.slice(i, i + AUTH_BATCH)
    try {
      const result = await auth.getUsers(chunk.map(uid => ({ uid })))
      for (const record of result.users) {
        out.set(record.uid, {
          name: str(record.displayName),
          email: cleanEmail(str(record.email)),
          phone: str(record.phoneNumber),
        })
      }
    } catch (err) {
      console.warn('Merchant report Auth enrich batch failed:', err)
    }
  }
  return out
}

export async function enrichMerchantReports(
  items: MerchantReport[],
): Promise<MerchantReport[]> {
  if (items.length === 0) return items

  const merchantIds = [...new Set(items.map(i => i.merchantId).filter(Boolean))]
  const reporterUids = [
    ...new Set(items.map(i => i.reporterUid).filter((uid): uid is string => Boolean(uid))),
  ]
  const authUids = [...new Set([...merchantIds, ...reporterUids])]

  const [merchantContacts, reporterFirestore, authContacts] = await Promise.all([
    Promise.all(
      merchantIds.map(async id => [id, await loadMerchantContact(id)] as const),
    ).then(rows => new Map(rows)),
    Promise.all(
      reporterUids.map(async uid => {
        const snap = await getAdminDb().collection('users').doc(uid).get()
        if (!snap.exists) return [uid, { name: '', email: '', phone: '' }] as const
        return [uid, contactFromMap(snap.data() as Record<string, unknown>)] as const
      }),
    ).then(rows => new Map(rows)),
    loadAuthContacts(authUids),
  ])

  return Promise.all(
    items.map(async item => {
      const merchantDoc = merchantContacts.get(item.merchantId) || {
        name: '',
        email: '',
        phone: '',
      }
      const merchantAuth = authContacts.get(item.merchantId)
      const merchant = mergeContact(merchantDoc, merchantAuth || { name: '', email: '', phone: '' })

      const reporterDoc = item.reporterUid
        ? reporterFirestore.get(item.reporterUid)
        : undefined
      const reporterAuth = item.reporterUid ? authContacts.get(item.reporterUid) : undefined
      const reporter = mergeContact(reporterDoc || { name: '', email: '', phone: '' }, reporterAuth || {
        name: '',
        email: '',
        phone: '',
      })
      const reporterEmail =
        cleanEmail(str(item.reporterEmail)) || reporter.email || null
      const reporterPhone = reporter.phone || null

      const storedName = str(item.merchantName)
      const merchantName =
        merchant.name ||
        (storedName && storedName !== 'Merchant' ? storedName : '') ||
        merchant.email ||
        merchant.phone ||
        storedName ||
        'Merchant'

      const proofUrls = (
        await Promise.all(
          (item.proofUrls.length > 0
            ? item.proofUrls
            : item.proofUrl
              ? [item.proofUrl]
              : []
          ).map(url => resolveStorageDownloadUrl(url)),
        )
      ).filter((url): url is string => Boolean(url))

      return {
        ...item,
        merchantName,
        merchantEmail: merchant.email || null,
        merchantPhone: merchant.phone || null,
        reporterEmail,
        reporterPhone,
        proofUrl: proofUrls[0] || null,
        proofUrls,
      }
    }),
  )
}
