import 'server-only'

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import type { WalletRow, WalletTxRow } from '@/lib/finance'

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
    if (v && v.toLowerCase() !== 'vero360app') return v
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

async function loadContact(uid: string): Promise<Contact> {
  const id = uid.trim()
  if (!id || id === 'super_admin') return { name: '', email: '', phone: '' }

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
      console.warn('Finance Auth enrich batch failed:', err)
    }
  }
  return out
}

/** Attach merchant email / phone (and better name when available) to wallets + txs. */
export async function enrichFinanceMerchants(
  wallets: WalletRow[],
  transactions: WalletTxRow[],
): Promise<{ wallets: WalletRow[]; transactions: WalletTxRow[] }> {
  const uids = [
    ...new Set(
      wallets
        .map(w => w.userId)
        .concat(transactions.map(t => t.userId || '').filter(Boolean))
        .filter(uid => uid && uid !== 'super_admin'),
    ),
  ]

  const [docContacts, authContacts] = await Promise.all([
    Promise.all(uids.map(async uid => [uid, await loadContact(uid)] as const)).then(
      rows => new Map(rows),
    ),
    loadAuthContacts(uids),
  ])

  const contactByUid = new Map<string, Contact>()
  for (const uid of uids) {
    contactByUid.set(
      uid,
      mergeContact(
        docContacts.get(uid) || { name: '', email: '', phone: '' },
        authContacts.get(uid) || { name: '', email: '', phone: '' },
      ),
    )
  }

  const enrichedWallets = wallets.map(w => {
    if (w.isPlatform) {
      return { ...w, merchantEmail: null, merchantPhone: null }
    }
    const c = contactByUid.get(w.userId)
    const storedName = str(w.merchantName)
    const nameLooksGeneric =
      !storedName ||
      storedName === 'Merchant' ||
      storedName.toLowerCase() === 'vero360app'
    return {
      ...w,
      merchantName: (!nameLooksGeneric ? storedName : '') || c?.name || storedName || 'Merchant',
      merchantEmail: c?.email || null,
      merchantPhone: c?.phone || null,
    }
  })

  const walletById = new Map(enrichedWallets.map(w => [w.walletId, w]))

  const enrichedTx = transactions.map(t => {
    const wallet = walletById.get(t.walletId)
    const uid = t.userId || wallet?.userId || ''
    const c = uid ? contactByUid.get(uid) : undefined
    const name =
      (wallet?.merchantName && wallet.merchantName !== 'Merchant'
        ? wallet.merchantName
        : null) ||
      c?.name ||
      t.merchantName
    return {
      ...t,
      merchantName: name,
      merchantEmail: wallet?.merchantEmail || c?.email || null,
      merchantPhone: wallet?.merchantPhone || c?.phone || null,
      userId: uid || t.userId,
    }
  })

  return { wallets: enrichedWallets, transactions: enrichedTx }
}
