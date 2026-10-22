'use client'
import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_orders_last_seen_ids'
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

/**
 * Polls marketplace / food orders for admin badges / toasts.
 * Toasts fire for any new order, not only pending ones.
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
          recentIds?: number[]
          latest?: {
            id?: number
            orderNumber?: string
            itemName?: string
            category?: string
          } | null
        }
        if (cancelled) return

        const pending = Array.isArray(data.pendingIds)
          ? data.pendingIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
          : []
        const recent = Array.isArray(data.recentIds)
          ? data.recentIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
          : pending
        setPendingIds(pending)

        const known = readIds(sessionStorage, STORAGE_KEY)
        if (!primed.current) {
          writeIds(sessionStorage, STORAGE_KEY, recent.length ? recent : known)
          primed.current = true
          return
        }

        const knownSet = new Set(known)
        const fresh = recent.filter(id => !knownSet.has(id))
        if (fresh.length > 0) {
          const latest = data.latest
          const food =
            String(latest?.category || '').toLowerCase() === 'food'
          const label = food ? 'food order' : 'order'
          const name = latest?.itemName ? ` · ${latest.itemName}` : ''
          const message =
            fresh.length === 1
              ? `New ${label} #${latest?.orderNumber || fresh[0]}${name}`
              : `${fresh.length} new ${food ? 'food' : 'marketplace'} orders`
          setToast(message)
          notifyBrowser(food ? 'New food order' : 'New order', message, 'vero-orders')
          writeIds(sessionStorage, STORAGE_KEY, [...new Set([...known, ...recent])])
        } else {
          writeIds(sessionStorage, STORAGE_KEY, recent)
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
