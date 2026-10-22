'use client'

import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 15_000
const STORAGE_KEY = 'vero_rides_last_seen_ids'
const SEEN_KEY = 'vero_rides_seen_recent_ids'

export type RideAlertState = {
  issues: number
  unseen: number
  toast: string | null
  clearToast: () => void
  markRidesSeen: () => void
}

function parseIdList(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(Number).filter(n => Number.isFinite(n) && n > 0)
      : []
  } catch {
    return []
  }
}

function readIds(): number[] {
  try {
    return parseIdList(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function writeIds(ids: number[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    // ignore
  }
}

function readIdsFrom(storage: Storage, key: string): number[] {
  try {
    return parseIdList(storage.getItem(key))
  } catch {
    return []
  }
}

function writeIdsTo(storage: Storage, key: string, ids: number[]) {
  try {
    storage.setItem(key, JSON.stringify(ids.slice(0, 400)))
  } catch {
    // ignore
  }
}

/**
 * Polls new rides and issue count for admin badges / toasts.
 */
export function useRideAlerts(enabled = true): RideAlertState {
  const [issues, setIssues] = useState(0)
  const [recentIds, setRecentIds] = useState<number[]>([])
  const [seenIds, setSeenIds] = useState<number[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const lastCount = useRef(0)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    setSeenIds(readIdsFrom(localStorage, SEEN_KEY))
    const onStorage = (e: StorageEvent) => {
      if (e.key === SEEN_KEY) setSeenIds(readIdsFrom(localStorage, SEEN_KEY))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const markRidesSeen = useCallback(() => {
    setToast(null)
    setSeenIds(prev => {
      const next = [...new Set([...recentIds, ...prev])]
      writeIdsTo(localStorage, SEEN_KEY, next)
      return next
    })
  }, [recentIds])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await adminFetch('/api/admin/rides/pending', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as {
          issues?: number
          recentIds?: number[]
          latest?: { id?: number; pickupAddress?: string | null; passengerName?: string | null } | null
        }
        if (cancelled) return

        const count = typeof data.issues === 'number' ? data.issues : 0
        setIssues(count)
        const recent = Array.isArray(data.recentIds)
          ? data.recentIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
          : []
        setRecentIds(recent)

        if (!primed.current) {
          primed.current = true
          lastCount.current = count
          writeIds(recent.length ? recent : readIds())
          if (!readIdsFrom(localStorage, SEEN_KEY).length && recent.length) {
            writeIdsTo(localStorage, SEEN_KEY, recent)
            setSeenIds(recent)
          }
          return
        }

        const known = readIds()
        const knownSet = new Set(known)
        const fresh = recent.filter(id => !knownSet.has(id))
        if (fresh.length > 0) {
          const latest = data.latest
          const where = latest?.pickupAddress ? ` · ${latest.pickupAddress}` : ''
          const who = latest?.passengerName ? ` · ${latest.passengerName}` : ''
          const message =
            fresh.length === 1
              ? `New Vero Ride #${latest?.id || fresh[0]}${who}${where}`
              : `${fresh.length} new Vero Ride trips`
          setToast(message)
          notifyBrowser('New Vero Ride', message, 'vero-rides')
          writeIds([...new Set([...known, ...recent])])
        } else if (count > lastCount.current) {
          const delta = count - lastCount.current
          const message =
            delta === 1
              ? '1 ride trip needs attention'
              : `${delta} ride trips need attention`
          setToast(message)
          notifyBrowser('Vero Ride', message, 'vero-ride-issues')
          if (recent.length) writeIds(recent)
        } else if (recent.length) {
          writeIds(recent)
        }
        lastCount.current = count
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

  const seenSet = new Set(seenIds)
  const unseen = recentIds.filter(id => !seenSet.has(id)).length

  return { issues, unseen, toast, clearToast, markRidesSeen }
}
