'use client'

import { notifyBrowser } from '@/lib/admin-browser-notify'
import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 15_000
const STORAGE_KEY = 'vero_rides_last_seen_ids'

export type RideAlertState = {
  issues: number
  toast: string | null
  clearToast: () => void
}

function readIds(): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(Number).filter(n => Number.isFinite(n) && n > 0)
      : []
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

/**
 * Polls new rides and issue count for admin badges / toasts.
 */
export function useRideAlerts(enabled = true): RideAlertState {
  const [issues, setIssues] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const lastCount = useRef(0)
  const clearToast = useCallback(() => setToast(null), [])

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

        if (!primed.current) {
          primed.current = true
          lastCount.current = count
          writeIds(recent.length ? recent : readIds())
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

  return { issues, toast, clearToast }
}
