'use client'

import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 15_000
const STORAGE_KEY = 'vero_stay_last_seen_ids'
const SEEN_KEY = 'vero_stay_seen_pending_ids'

export type StayAlertState = {
  pending: number
  toast: string | null
  clearToast: () => void
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
    storage.setItem(key, JSON.stringify(ids.slice(0, 400)))
  } catch {
    // ignore
  }
}

export function useStayAlerts(enabled = true): StayAlertState {
  const [pendingIds, setPendingIds] = useState<number[]>([])
  const [seenIds, setSeenIds] = useState<number[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    setSeenIds(readIds(localStorage, SEEN_KEY))
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/stay/bookings/pending', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          pendingIds?: number[]
          recentIds?: number[]
          latest?: {
            id?: number
            bookingNumber?: string
            accommodationName?: string | null
            guestName?: string | null
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
          const place = latest?.accommodationName ? ` · ${latest.accommodationName}` : ''
          const who = latest?.guestName ? ` · ${latest.guestName}` : ''
          const message =
            fresh.length === 1
              ? `New stay booking ${latest?.bookingNumber || `#${fresh[0]}`}${place}${who}`
              : `${fresh.length} new stay bookings`
          setToast(message)
          notifyBrowser('New stay booking', message, 'vero-stay')
          writeIds(sessionStorage, STORAGE_KEY, [...new Set([...known, ...recent])])
        } else {
          writeIds(sessionStorage, STORAGE_KEY, recent)
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

  const seenSet = new Set(seenIds)
  const pending = pendingIds.filter(id => !seenSet.has(id)).length

  return { pending, toast, clearToast }
}
