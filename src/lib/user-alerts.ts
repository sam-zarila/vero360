'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppUser } from '@/lib/users'

const POLL_MS = 15_000
const SEEN_KEY = 'vero_admin_seen_user_ids'
const NOTIFIED_KEY = 'vero_admin_notified_user_ids'

export type UserAlertState = {
  users: AppUser[]
  loading: boolean
  error: string
  newCount: number
  toast: string | null
  clearToast: () => void
  markUsersSeen: () => void
  refresh: () => Promise<void>
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
    sessionStorage.setItem(key, JSON.stringify(ids.slice(0, 2000)))
  } catch {
    // ignore
  }
}

function notifyBrowser(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'vero-new-user' })
    } catch {
      // ignore
    }
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'vero-new-user' })
        } catch {
          // ignore
        }
      }
    })
  }
}

/**
 * Loads app users via Admin API (bypasses client Firestore rules)
 * and alerts when new accounts register.
 */
export function useUserAlerts(enabled = true): UserAlertState {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const primed = useRef(false)
  const clearToast = useCallback(() => setToast(null), [])

  const applyUsers = useCallback((next: AppUser[]) => {
    setUsers(next)
    const ids = next.map(u => u.id)
    const seen = readIds(SEEN_KEY)
    const notified = readIds(NOTIFIED_KEY)

    if (!primed.current) {
      if (!seen.length) writeIds(SEEN_KEY, ids)
      if (!notified.length) writeIds(NOTIFIED_KEY, ids)
      primed.current = true
      const unseen = ids.filter(id => !new Set(readIds(SEEN_KEY)).has(id))
      setNewCount(unseen.length)
      return
    }

    const seenSet = new Set(readIds(SEEN_KEY))
    const notifiedSet = new Set(readIds(NOTIFIED_KEY))
    const unseen = ids.filter(id => !seenSet.has(id))
    const fresh = ids.filter(id => !notifiedSet.has(id))

    setNewCount(unseen.length)

    if (fresh.length > 0) {
      const message =
        fresh.length === 1
          ? 'New user registered on Vero360'
          : `${fresh.length} new users registered on Vero360`
      setToast(message)
      notifyBrowser('New Vero360 user', message)
      writeIds(NOTIFIED_KEY, [...new Set([...notified, ...ids])])
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')
      applyUsers(Array.isArray(data.users) ? data.users : [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [applyUsers])

  const markUsersSeen = useCallback(() => {
    const ids = users.map(u => u.id)
    writeIds(SEEN_KEY, ids)
    writeIds(NOTIFIED_KEY, ids)
    setNewCount(0)
  }, [users])

  useEffect(() => {
    if (!enabled) return

    setLoading(true)
    void refresh()
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, refresh])

  return {
    users,
    loading,
    error,
    newCount,
    toast,
    clearToast,
    markUsersSeen,
    refresh,
  }
}
