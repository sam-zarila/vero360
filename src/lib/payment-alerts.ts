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

export type PaymentAlertState = {
  digitalNew: number
  homepageAdNew: number
  promoNew: number
  toast: string | null
  toastHref: string | null
  clearToast: () => void
  markDigitalSeen: () => void
  markHomepageAdSeen: () => void
}

type PaidItem = {
  id: string
  kind: 'digital' | 'homepage_ad' | 'promotion'
  title: string
  amountMwk: number
  buyerName: string
  buyerEmail: string
  paidAt: string | null
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
  const [toast, setToast] = useState<string | null>(null)
  const [toastHref, setToastHref] = useState<string | null>(null)
  const latestDigitalIds = useRef<string[]>([])
  const latestAdIds = useRef<string[]>([])
  const latestPromoIds = useRef<string[]>([])
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
          digitalIds?: string[]
          homepageAdIds?: string[]
          promotionIds?: string[]
        }
        if (cancelled) return

        const digitalItems = Array.isArray(data.digital) ? data.digital : []
        const adItems = Array.isArray(data.homepageAds) ? data.homepageAds : []
        const promoItems = Array.isArray(data.promotions) ? data.promotions : []
        const digitalIds = Array.isArray(data.digitalIds)
          ? data.digitalIds.map(String)
          : digitalItems.map(d => d.id)
        const adIds = Array.isArray(data.homepageAdIds)
          ? data.homepageAdIds.map(String)
          : adItems.map(a => a.id)
        const promoIds = Array.isArray(data.promotionIds)
          ? data.promotionIds.map(String)
          : promoItems.map(p => p.id)

        latestDigitalIds.current = digitalIds
        latestAdIds.current = adIds
        latestPromoIds.current = promoIds

        const digitalSeen = readIds(DIGITAL_SEEN_KEY)
        const adsSeen = readIds(ADS_SEEN_KEY)
        const promoSeen = readIds(PROMO_SEEN_KEY)
        const digitalNotified = readIds(DIGITAL_NOTIFIED_KEY)
        const adsNotified = readIds(ADS_NOTIFIED_KEY)
        const promoNotified = readIds(PROMO_NOTIFIED_KEY)

        if (!primed.current) {
          if (!digitalSeen.length) writeIds(DIGITAL_SEEN_KEY, digitalIds)
          if (!adsSeen.length) writeIds(ADS_SEEN_KEY, adIds)
          if (!promoSeen.length) writeIds(PROMO_SEEN_KEY, promoIds)
          if (!digitalNotified.length) writeIds(DIGITAL_NOTIFIED_KEY, digitalIds)
          if (!adsNotified.length) writeIds(ADS_NOTIFIED_KEY, adIds)
          if (!promoNotified.length) writeIds(PROMO_NOTIFIED_KEY, promoIds)
          primed.current = true
          setDigitalNew(
            digitalIds.filter(id => !new Set(readIds(DIGITAL_SEEN_KEY)).has(id)).length,
          )
          setHomepageAdNew(adIds.filter(id => !new Set(readIds(ADS_SEEN_KEY)).has(id)).length)
          setPromoNew(promoIds.filter(id => !new Set(readIds(PROMO_SEEN_KEY)).has(id)).length)
          return
        }

        const digitalSeenSet = new Set(readIds(DIGITAL_SEEN_KEY))
        const adsSeenSet = new Set(readIds(ADS_SEEN_KEY))
        const promoSeenSet = new Set(readIds(PROMO_SEEN_KEY))
        const digitalNotifiedSet = new Set(readIds(DIGITAL_NOTIFIED_KEY))
        const adsNotifiedSet = new Set(readIds(ADS_NOTIFIED_KEY))
        const promoNotifiedSet = new Set(readIds(PROMO_NOTIFIED_KEY))

        const unseenDigital = digitalIds.filter(id => !digitalSeenSet.has(id))
        const unseenAds = adIds.filter(id => !adsSeenSet.has(id))
        const unseenPromo = promoIds.filter(id => !promoSeenSet.has(id))
        const freshDigital = digitalIds.filter(id => !digitalNotifiedSet.has(id))
        const freshAds = adIds.filter(id => !adsNotifiedSet.has(id))
        const freshPromo = promoIds.filter(id => !promoNotifiedSet.has(id))

        setDigitalNew(unseenDigital.length)
        setHomepageAdNew(unseenAds.length)
        setPromoNew(unseenPromo.length)

        if (freshDigital.length > 0 || freshAds.length > 0 || freshPromo.length > 0) {
          const dMsg = freshDigital.length ? digitalMessage(freshDigital, digitalItems) : null
          const aMsg = freshAds.length ? adsMessage(freshAds, adItems) : null
          const pMsg = freshPromo.length ? promoMessage(freshPromo, promoItems) : null
          const parts = [dMsg, aMsg, pMsg].filter(Boolean) as string[]
          const combined = parts.join('. Also: ')
          setToast(combined)
          setToastHref(
            dMsg
              ? '/dashboard/digital-services'
              : aMsg
                ? '/dashboard/homepage-ads'
                : '/dashboard/marketplace-promotions',
          )
          notifyBrowser('New payment', combined, 'vero-payments')

          if (freshDigital.length) {
            writeIds(DIGITAL_NOTIFIED_KEY, [...new Set([...digitalNotified, ...digitalIds])])
          }
          if (freshAds.length) {
            writeIds(ADS_NOTIFIED_KEY, [...new Set([...adsNotified, ...adIds])])
          }
          if (freshPromo.length) {
            writeIds(PROMO_NOTIFIED_KEY, [...new Set([...promoNotified, ...promoIds])])
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
    toast,
    toastHref,
    clearToast,
    markDigitalSeen,
    markHomepageAdSeen,
  }
}
