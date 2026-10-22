'use client'

import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 12_000
const STORAGE_KEY = 'vero_food_last_seen_ids'
const SEEN_KEY = 'vero_food_seen_pending_ids'

export type FoodAlertState = {
  pending: number
  toast: string | null
  clearToast: () => void
  markFoodSeen: () => void
}

function readIds(storage: Storage, key: string): string[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeIds(storage: Storage, key: string, ids: string[]) {
  try {
    storage.setItem(key, JSON.stringify(ids.slice(0, 500)))
  } catch {
    // ignore quota / private mode
  }
}

export function useFoodAlerts(enabled = true): FoodAlertState {
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [seenIds, setSeenIds] = useState<string[]>([])
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

  const markFoodSeen = useCallback(() => {
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
        const res = await adminFetch('/api/admin/food-orders/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          pendingIds?: string[]
          recentIds?: string[]
          latest?: {
            id?: string
            orderNumber?: string
            kitchen?: string
            customerName?: string
          } | null
        }
        if (cancelled) return

        const pending = Array.isArray(data.pendingIds)
          ? data.pendingIds.map(String).filter(Boolean)
          : []
        const recent = Array.isArray(data.recentIds)
          ? data.recentIds.map(String).filter(Boolean)
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
          const kitchen = latest?.kitchen ? ` · ${latest.kitchen}` : ''
          const who = latest?.customerName ? ` · ${latest.customerName}` : ''
          const message =
            fresh.length === 1
              ? `New food order ${latest?.orderNumber || fresh[0]}${kitchen}${who}`
              : `${fresh.length} new food orders`
          setToast(message)
          notifyBrowser('New food order', message, 'vero-food')
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

  return { pending, toast, clearToast, markFoodSeen }
}
