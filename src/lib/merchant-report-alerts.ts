'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_merchant_reports_open_ids'

export type MerchantReportAlertState = {
  open: number
  toast: string | null
  clearToast: () => void
}

function readKnownIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(String).filter(id => id.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function writeKnownIds(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    // ignore quota / private mode
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'vero-merchant-reports' })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'vero-merchant-reports' })
        } catch {
          // ignore
        }
      }
    })
  }
}

/** Polls open merchant reports for admin badges / toasts. */
export function useMerchantReportAlerts(enabled = true): MerchantReportAlertState {
  const [open, setOpen] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/merchant-reports/open', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          open?: number
          openIds?: string[]
          latest?: { merchantName?: string }
        }
        if (cancelled) return

        const openIds = Array.isArray(data.openIds)
          ? data.openIds.map(String).filter(id => id.trim().length > 0)
          : []
        const count = typeof data.open === 'number' ? data.open : openIds.length
        setOpen(count)

        const known = readKnownIds()
        if (!primed.current) {
          writeKnownIds(openIds.length ? openIds : known)
          primed.current = true
          return
        }

        const knownSet = new Set(known)
        const fresh = openIds.filter(id => !knownSet.has(id))
        if (fresh.length > 0) {
          const merchant = data.latest?.merchantName?.trim() || 'a merchant'
          const message =
            fresh.length === 1
              ? `New report against ${merchant} — review in Merchant reports`
              : `${fresh.length} new merchant reports — review in Merchant reports`
          setToast(message)
          notifyBrowser('New merchant report', message)
          writeKnownIds([...new Set([...known, ...openIds])])
        } else {
          writeKnownIds(openIds)
        }
      } catch {
        // keep last known count
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

  return { open, toast, clearToast }
}
