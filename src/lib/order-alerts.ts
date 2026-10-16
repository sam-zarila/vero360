'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_orders_last_pending_ids'
const SEEN_KEY = 'vero_orders_seen_pending_ids'

export type OrderAlertState = {
  /** Pending orders this admin has not opened yet. */
  pending: number
  toast: string | null
  clearToast: () => void
  markOrdersSeen: () => void
}

function readIds(storage: Storage, key: string): number[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(Number).filter(n => Number.isFinite(n) && n > 0)
      : []
  } catch {
    return []
  }
}

function writeIds(storage: Storage, key: string, ids: number[]) {
  try {
    storage.setItem(key, JSON.stringify(ids.slice(0, 500)))
  } catch {
    // ignore quota / private mode
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'vero-orders-pending' })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'vero-orders-pending' })
        } catch {
          // ignore
        }
      }
    })
  }
}

/**
 * Polls pending marketplace orders for admin badges / toasts.
 */
export function useOrderAlerts(enabled = true): OrderAlertState {
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const [seenIds, setSeenIds] = useState<number[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    setSeenIds(readIds(localStorage, SEEN_KEY))
    const onStorage = (e: StorageEvent) => {
      if (e.key === SEEN_KEY) setSeenIds(readIds(localStorage, SEEN_KEY))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const markOrdersSeen = useCallback(() => {
    setToast(null)
    setSeenIds(prev => {
      const next = [...new Set([...pendingIds, ...prev])]
      writeIds(localStorage, SEEN_KEY, next)
      return next
    })
  }, [pendingIds])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/orders/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          pending?: number
          pendingIds?: number[]
        }
        if (cancelled) return

        const ids = Array.isArray(data.pendingIds)
          ? data.pendingIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
          : []
        setPendingIds(ids)

        const known = readIds(sessionStorage, STORAGE_KEY)
        if (!primed.current) {
          writeIds(sessionStorage, STORAGE_KEY, ids.length ? ids : known)
          primed.current = true
          return
        }

        const knownSet = new Set(known)
        const fresh = ids.filter(id => !knownSet.has(id))
        if (fresh.length > 0) {
          const message =
            fresh.length === 1
              ? `New marketplace order #${fresh[0]}. Review in Orders`
              : `${fresh.length} new marketplace orders. Review in Orders`
          setToast(message)
          notifyBrowser('New marketplace order', message)
          writeIds(sessionStorage, STORAGE_KEY, [...new Set([...known, ...ids])])
        } else {
          writeIds(sessionStorage, STORAGE_KEY, ids)
        }
      } catch {
        // keep last known pending
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

  const seenSet = new Set(seenIds)
  const pending = pendingIds.filter(id => !seenSet.has(id)).length

  return { pending, toast, clearToast, markOrdersSeen }
}
