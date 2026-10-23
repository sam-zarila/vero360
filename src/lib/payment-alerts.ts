'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const DIGITAL_SEEN_KEY = 'vero_admin_digital_paid_seen'
const DIGITAL_NOTIFIED_KEY = 'vero_admin_digital_paid_notified'
const ADS_SEEN_KEY = 'vero_admin_homepage_ad_paid_seen'
const ADS_NOTIFIED_KEY = 'vero_admin_homepage_ad_paid_notified'
const PROMO_SEEN_KEY = 'vero_admin_promo_paid_seen'
const PROMO_NOTIFIED_KEY = 'vero_admin_promo_paid_notified'
const BANK_SEEN_KEY = 'vero_admin_bank_transfer_seen'
const BANK_NOTIFIED_KEY = 'vero_admin_bank_transfer_notified'

export type PaymentAlertState = {
  digitalNew: number
  homepageAdNew: number
  promoNew: number
  bankNew: number
  toast: string | null
  toastHref: string | null
  clearToast: () => void
  markDigitalSeen: () => void
  markHomepageAdSeen: () => void
  markBankSeen: () => void
}

type PaidItem = {
  id: string
  kind: 'digital' | 'homepage_ad' | 'promotion' | 'bank_transfer'
  title: string
  amountMwk: number
  buyerName: string
  buyerEmail: string
  paidAt: string | null
  source?: string
  href?: string
  sourceLabel?: string
}

function readIds(key: string): string[] {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids.slice(0, 500)))
  } catch {
    // ignore
  }
}

function formatMwk(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 'MWK 0'
  return `MWK ${Math.round(amount).toLocaleString('en-MW')}`
}

function notifyBrowser(title: string, body: string, tag: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag })
        } catch {
          // ignore
        }
      }
    })
  }
}

function digitalMessage(fresh: string[], items: PaidItem[]) {
  if (fresh.length === 1) {
    const latest = items.find(d => d.id === fresh[0])
    if (latest) {
      return `Digital service paid · ${latest.title} · ${formatMwk(latest.amountMwk)}${
        latest.buyerName ? ` · ${latest.buyerName}` : ''
      }`
    }
    return 'New digital service payment'
  }
  return `${fresh.length} new digital service payments`
}

function promoMessage(fresh: string[], items: PaidItem[]) {
  if (fresh.length === 1) {
    const latest = items.find(p => p.id === fresh[0])
    if (latest) {
      return `Promote paid · ${latest.title} · ${formatMwk(latest.amountMwk)}${
        latest.buyerName ? ` · ${latest.buyerName}` : ''
      }`
    }
    return 'New promote payment'
  }
  return `${fresh.length} new promote payments`
}

function bankMessage(fresh: string[], items: PaidItem[]) {
  if (fresh.length === 1) {
    const latest = items.find(b => b.id === fresh[0])
    if (latest) {
      const where = latest.sourceLabel || latest.source || 'checkout'
      return `Bank transfer · ${where} · ${latest.title} · ${formatMwk(latest.amountMwk)}${
        latest.buyerName ? ` · ${latest.buyerName}` : ''
      }`
    }
    return 'New bank transfer order'
  }
  return `${fresh.length} new bank transfer orders`
}

function adsMessage(fresh: string[], items: PaidItem[]) {
  if (fresh.length === 1) {
    const latest = items.find(a => a.id === fresh[0])
    if (latest) {
      return `Homepage ad paid · ${latest.title} · ${formatMwk(latest.amountMwk)}${
        latest.buyerName ? ` · ${latest.buyerName}` : ''
      }`
    }
    return 'New homepage advert payment'
  }
  return `${fresh.length} new homepage advert payments`
}

/**
 * Polls paid digital-service + homepage-ad purchases for admin toasts/badges
 * (same pattern as courier / new-user alerts).
 */
export function usePaymentAlerts(enabled = true): PaymentAlertState {
  const [digitalNew, setDigitalNew] = useState(0)
  const [homepageAdNew, setHomepageAdNew] = useState(0)
  const [promoNew, setPromoNew] = useState(0)
  const [bankNew, setBankNew] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [toastHref, setToastHref] = useState<string | null>(null)
  const latestDigitalIds = useRef<string[]>([])
  const latestAdIds = useRef<string[]>([])
  const latestPromoIds = useRef<string[]>([])
  const latestBankIds = useRef<string[]>([])
  const primed = useRef(false)

  const clearToast = useCallback(() => {
    setToast(null)
    setToastHref(null)
  }, [])

  const markDigitalSeen = useCallback(() => {
    const ids = latestDigitalIds.current
    if (!ids.length) return
    writeIds(DIGITAL_SEEN_KEY, ids)
    setDigitalNew(0)
  }, [])

  const markHomepageAdSeen = useCallback(() => {
    const ids = latestAdIds.current
    if (!ids.length) return
    writeIds(ADS_SEEN_KEY, ids)
    setHomepageAdNew(0)
  }, [])

  const markBankSeen = useCallback(() => {
    const ids = latestBankIds.current
    if (!ids.length) return
    writeIds(BANK_SEEN_KEY, ids)
    setBankNew(0)
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/payments/recent', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          digital?: PaidItem[]
          homepageAds?: PaidItem[]
          promotions?: PaidItem[]
          bankTransfers?: PaidItem[]
          digitalIds?: string[]
          homepageAdIds?: string[]
          promotionIds?: string[]
          bankTransferIds?: string[]
        }
        if (cancelled) return

        const digitalItems = Array.isArray(data.digital) ? data.digital : []
        const adItems = Array.isArray(data.homepageAds) ? data.homepageAds : []
        const promoItems = Array.isArray(data.promotions) ? data.promotions : []
        const bankItems = Array.isArray(data.bankTransfers) ? data.bankTransfers : []
        const digitalIds = Array.isArray(data.digitalIds)
          ? data.digitalIds.map(String)
          : digitalItems.map(d => d.id)
        const adIds = Array.isArray(data.homepageAdIds)
          ? data.homepageAdIds.map(String)
          : adItems.map(a => a.id)
        const promoIds = Array.isArray(data.promotionIds)
          ? data.promotionIds.map(String)
          : promoItems.map(p => p.id)
        const bankIds = Array.isArray(data.bankTransferIds)
          ? data.bankTransferIds.map(String)
          : bankItems.map(b => b.id)

        latestDigitalIds.current = digitalIds
        latestAdIds.current = adIds
        latestPromoIds.current = promoIds
        latestBankIds.current = bankIds

        const digitalSeen = readIds(DIGITAL_SEEN_KEY)
        const adsSeen = readIds(ADS_SEEN_KEY)
        const promoSeen = readIds(PROMO_SEEN_KEY)
        const bankSeen = readIds(BANK_SEEN_KEY)
        const digitalNotified = readIds(DIGITAL_NOTIFIED_KEY)
        const adsNotified = readIds(ADS_NOTIFIED_KEY)
        const promoNotified = readIds(PROMO_NOTIFIED_KEY)
        const bankNotified = readIds(BANK_NOTIFIED_KEY)

        if (!primed.current) {
          if (!digitalSeen.length) writeIds(DIGITAL_SEEN_KEY, digitalIds)
          if (!adsSeen.length) writeIds(ADS_SEEN_KEY, adIds)
          if (!promoSeen.length) writeIds(PROMO_SEEN_KEY, promoIds)
          if (!bankSeen.length) writeIds(BANK_SEEN_KEY, bankIds)
          if (!digitalNotified.length) writeIds(DIGITAL_NOTIFIED_KEY, digitalIds)
          if (!adsNotified.length) writeIds(ADS_NOTIFIED_KEY, adIds)
          if (!promoNotified.length) writeIds(PROMO_NOTIFIED_KEY, promoIds)
          if (!bankNotified.length) writeIds(BANK_NOTIFIED_KEY, bankIds)
          primed.current = true
          setDigitalNew(
            digitalIds.filter(id => !new Set(readIds(DIGITAL_SEEN_KEY)).has(id)).length,
          )
          setHomepageAdNew(adIds.filter(id => !new Set(readIds(ADS_SEEN_KEY)).has(id)).length)
          setPromoNew(promoIds.filter(id => !new Set(readIds(PROMO_SEEN_KEY)).has(id)).length)
          setBankNew(bankIds.filter(id => !new Set(readIds(BANK_SEEN_KEY)).has(id)).length)
          return
        }

        const digitalSeenSet = new Set(readIds(DIGITAL_SEEN_KEY))
        const adsSeenSet = new Set(readIds(ADS_SEEN_KEY))
        const promoSeenSet = new Set(readIds(PROMO_SEEN_KEY))
        const bankSeenSet = new Set(readIds(BANK_SEEN_KEY))
        const digitalNotifiedSet = new Set(readIds(DIGITAL_NOTIFIED_KEY))
        const adsNotifiedSet = new Set(readIds(ADS_NOTIFIED_KEY))
        const promoNotifiedSet = new Set(readIds(PROMO_NOTIFIED_KEY))
        const bankNotifiedSet = new Set(readIds(BANK_NOTIFIED_KEY))

        const unseenDigital = digitalIds.filter(id => !digitalSeenSet.has(id))
        const unseenAds = adIds.filter(id => !adsSeenSet.has(id))
        const unseenPromo = promoIds.filter(id => !promoSeenSet.has(id))
        const unseenBank = bankIds.filter(id => !bankSeenSet.has(id))
        const freshDigital = digitalIds.filter(id => !digitalNotifiedSet.has(id))
        const freshAds = adIds.filter(id => !adsNotifiedSet.has(id))
        const freshPromo = promoIds.filter(id => !promoNotifiedSet.has(id))
        const freshBank = bankIds.filter(id => !bankNotifiedSet.has(id))

        setDigitalNew(unseenDigital.length)
        setHomepageAdNew(unseenAds.length)
        setPromoNew(unseenPromo.length)
        setBankNew(unseenBank.length)

        if (
          freshDigital.length > 0 ||
          freshAds.length > 0 ||
          freshPromo.length > 0 ||
          freshBank.length > 0
        ) {
          const dMsg = freshDigital.length ? digitalMessage(freshDigital, digitalItems) : null
          const aMsg = freshAds.length ? adsMessage(freshAds, adItems) : null
          const pMsg = freshPromo.length ? promoMessage(freshPromo, promoItems) : null
          const bMsg = freshBank.length ? bankMessage(freshBank, bankItems) : null
          const parts = [bMsg, dMsg, aMsg, pMsg].filter(Boolean) as string[]
          const combined = parts.join('. Also: ')
          const bankHref = bankItems.find(b => freshBank.includes(b.id))?.href
          setToast(combined)
          setToastHref(
            bMsg
              ? bankHref || '/dashboard/bank-transfers'
              : dMsg
                ? '/dashboard/digital-services'
                : aMsg
                  ? '/dashboard/homepage-ads'
                  : '/dashboard/marketplace-promotions',
          )
          notifyBrowser(bMsg ? 'New bank transfer' : 'New payment', combined, 'vero-payments')

          if (freshDigital.length) {
            writeIds(DIGITAL_NOTIFIED_KEY, [...new Set([...digitalNotified, ...digitalIds])])
          }
          if (freshAds.length) {
            writeIds(ADS_NOTIFIED_KEY, [...new Set([...adsNotified, ...adIds])])
          }
          if (freshPromo.length) {
            writeIds(PROMO_NOTIFIED_KEY, [...new Set([...promoNotified, ...promoIds])])
          }
          if (freshBank.length) {
            writeIds(BANK_NOTIFIED_KEY, [...new Set([...bankNotified, ...bankIds])])
          }
        }
      } catch {
        // keep last known
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    const onFocus = () => void poll()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled])

  return {
    digitalNew,
    homepageAdNew,
    promoNew,
    bankNew,
    toast,
    toastHref,
    clearToast,
    markDigitalSeen,
    markHomepageAdSeen,
    markBankSeen,
  }
}
