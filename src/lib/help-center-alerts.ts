'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'

const POLL_MS = 8_000

export function useHelpCenterUnread(): number {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setSignedIn(Boolean(user))
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready || !signedIn) {
      setUnread(0)
      return
    }

    let cancelled = false

    const tick = async () => {
      try {
        const headers = await panelAuthHeaders()
        const res = await adminFetch('/api/admin/verochat/sessions', { headers, cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setUnread(Number(data.unread || 0) || 0)
      } catch {
        // ignore poll failures
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [ready, signedIn])

  return unread
}
